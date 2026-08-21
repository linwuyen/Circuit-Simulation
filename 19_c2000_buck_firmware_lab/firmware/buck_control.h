#ifndef C2000_BUCK_CONTROL_H
#define C2000_BUCK_CONTROL_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    BUCK_STATE_OFF = 0,
    BUCK_STATE_SOFT_START,
    BUCK_STATE_RUN,
    BUCK_STATE_FAULT_LATCHED
} BuckState;

enum {
    BUCK_FAULT_NONE = 0u,
    BUCK_FAULT_OCP = 1u << 0,
    BUCK_FAULT_OVP = 1u << 1,
    BUCK_FAULT_SENSOR = 1u << 2,
    BUCK_FAULT_COMMAND_TIMEOUT = 1u << 3
};

typedef struct {
    float vref;
    float current_limit;
    float duty_min;
    float duty_max;
    float voltage_kp;
    float voltage_ki;
    float current_kp;
    float current_ki;
    float control_period_s;
    float soft_start_volts_per_second;
    float ovp_threshold;
    uint32_t command_timeout_ticks;
} BuckControlConfig;

typedef struct {
    float vin;
    float vout;
    float iL;
    uint8_t sensor_valid;
    uint8_t enable_request;
    uint8_t command_heartbeat;
    uint8_t clear_fault_request;
} BuckControlInput;

typedef struct {
    BuckState state;
    uint32_t fault_latch;
    uint32_t command_age_ticks;
    uint32_t control_ticks;
    float soft_vref;
    float current_reference;
    float voltage_integrator;
    float current_integrator;
    float duty;
} BuckControlState;

void BuckControl_init(BuckControlState *state);
void BuckControl_tick(
    const BuckControlConfig *config,
    const BuckControlInput *input,
    BuckControlState *state
);

#ifdef __cplusplus
}
#endif

#endif
