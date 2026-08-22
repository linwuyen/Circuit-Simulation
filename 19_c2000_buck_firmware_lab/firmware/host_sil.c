#include <math.h>
#include <stdio.h>
#include "buck_control.h"

typedef struct {
    float vin;
    float vout;
    float iL;
    float load_ohm;
} Plant;

static void plant_step(Plant *p, float duty, float dt)
{
    const float L = 0.0002f;
    const float C = 0.00047f;
    const float di = (duty * p->vin - p->vout) / L * dt;
    p->iL += di;
    if (p->iL < 0.0f) p->iL = 0.0f;
    p->vout += (p->iL - p->vout / p->load_ohm) / C * dt;
    if (p->vout < 0.0f) p->vout = 0.0f;
}

static BuckControlConfig config(void)
{
    BuckControlConfig c = {
        .vref = 12.0f,
        .current_limit = 8.0f,
        .duty_min = 0.0f,
        .duty_max = 0.90f,
        .voltage_kp = 0.30f,
        .voltage_ki = 100.0f,
        .current_kp = 0.02f,
        .current_ki = 500.0f,
        .control_period_s = 0.00001f,
        .soft_start_volts_per_second = 240.0f,
        .ovp_threshold = 14.0f,
        .command_timeout_ticks = 500u
    };
    return c;
}

int main(void)
{
    BuckControlConfig c = config();
    BuckControlState s;
    BuckControlInput in = {0};
    Plant p = {48.0f, 0.0f, 0.0f, 6.0f};
    int n;

    BuckControl_init(&s);
    in.enable_request = 1u;
    in.sensor_valid = 1u;
    in.peripherals_ready = 1u;
    in.calibration_valid = 1u;

    for (n = 0; n < 12000; ++n) {
        in.vin = p.vin;
        in.vout = p.vout;
        in.iL = p.iL;
        in.command_heartbeat = (n % 100) == 0;
        BuckControl_tick(&c, &in, &s);
        plant_step(&p, s.duty, c.control_period_s);
    }

    if (fabsf(p.vout - 12.0f) > 0.20f) {
        fprintf(stderr, "nominal regulation failed: %.3f V\n", p.vout);
        return 1;
    }

    in.command_heartbeat = 1u;
    in.iL = 9.5f;
    BuckControl_tick(&c, &in, &s);
    if ((s.fault_latch & BUCK_FAULT_OCP) == 0u || s.duty != 0.0f) {
        fprintf(stderr, "OCP failed to latch and veto PWM\n");
        return 2;
    }

    BuckControl_init(&s);
    in.vin = 48.0f;
    in.iL = 0.0f;
    in.vout = 0.0f;
    in.sensor_valid = 1u;
    in.enable_request = 1u;
    in.command_heartbeat = 0u;
    for (n = 0; n < 502; ++n) BuckControl_tick(&c, &in, &s);
    if ((s.fault_latch & BUCK_FAULT_COMMAND_TIMEOUT) == 0u || s.duty != 0.0f) {
        fprintf(stderr, "command timeout failed to fail closed\n");
        return 3;
    }

    BuckControl_init(&s);
    in.vin = 48.0f;
    in.sensor_valid = 1u;
    in.enable_request = 0u;
    in.command_heartbeat = 1u;
    BuckControl_tick(&c, &in, &s);
    if (s.state != BUCK_STATE_OFF || s.duty != 0.0f) {
        fprintf(stderr, "disabled controller must remain OFF\n");
        return 4;
    }

    BuckControl_init(&s);
    in.enable_request = 1u;
    in.command_heartbeat = 1u;
    in.calibration_valid = 0u;
    BuckControl_tick(&c, &in, &s);
    if ((s.fault_latch & BUCK_FAULT_SENSOR) == 0u || s.duty != 0.0f) {
        fprintf(stderr, "invalid calibration must fail closed\n");
        return 5;
    }

    BuckControl_init(&s);
    in.calibration_valid = 1u;
    in.hardware_trip_active = 1u;
    BuckControl_tick(&c, &in, &s);
    if ((s.fault_latch & BUCK_FAULT_OCP) == 0u || s.duty != 0.0f) {
        fprintf(stderr, "hardware trip must mirror into software OCP latch\n");
        return 6;
    }

    puts("C2000 Buck host SIL PASS: regulation, OCP/hardware veto, validity, timeout, idle-off");
    return 0;
}
