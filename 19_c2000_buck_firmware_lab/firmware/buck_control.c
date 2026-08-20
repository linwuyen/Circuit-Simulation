#include "buck_control.h"

static float clampf(float value, float low, float high)
{
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

void BuckControl_init(BuckControlState *state)
{
    state->state = BUCK_STATE_OFF;
    state->fault_latch = BUCK_FAULT_NONE;
    state->command_age_ticks = 0u;
    state->control_ticks = 0u;
    state->soft_vref = 0.0f;
    state->current_reference = 0.0f;
    state->voltage_integrator = 0.0f;
    state->current_integrator = 0.0f;
    state->duty = 0.0f;
}

void BuckControl_tick(
    const BuckControlConfig *config,
    const BuckControlInput *input,
    BuckControlState *state
)
{
    const float dt = 0.00001f;
    float voltage_error;
    float current_error;
    float voltage_u;
    float current_u;
    float duty_unsat;
    uint32_t detected = BUCK_FAULT_NONE;

    state->control_ticks++;

    if (input->command_heartbeat) state->command_age_ticks = 0u;
    else if (state->command_age_ticks < 0xFFFFFFFFu) state->command_age_ticks++;

    if (!input->sensor_valid) detected |= BUCK_FAULT_SENSOR;
    if (input->iout > config->current_limit * 1.08f) detected |= BUCK_FAULT_OCP;
    if (input->vout > config->ovp_threshold) detected |= BUCK_FAULT_OVP;
    if (state->command_age_ticks > config->command_timeout_ticks) detected |= BUCK_FAULT_COMMAND_TIMEOUT;

    state->fault_latch |= detected;

    if (state->fault_latch != BUCK_FAULT_NONE) {
        state->state = BUCK_STATE_FAULT_LATCHED;
        state->duty = 0.0f;
        state->current_reference = 0.0f;
        state->current_integrator = 0.0f;

        if (input->clear_fault_request &&
            input->sensor_valid &&
            input->iout < config->current_limit * 0.20f &&
            input->vout < config->vref * 0.50f &&
            state->command_age_ticks <= config->command_timeout_ticks) {
            state->fault_latch = BUCK_FAULT_NONE;
            state->state = BUCK_STATE_OFF;
            state->soft_vref = 0.0f;
            state->voltage_integrator = 0.0f;
        }
        return;
    }

    if (!input->enable_request) {
        state->state = BUCK_STATE_OFF;
        state->soft_vref = 0.0f;
        state->current_reference = 0.0f;
        state->voltage_integrator = 0.0f;
        state->current_integrator = 0.0f;
        state->duty = 0.0f;
        return;
    }

    if (state->state == BUCK_STATE_OFF) state->state = BUCK_STATE_SOFT_START;

    if (state->state == BUCK_STATE_SOFT_START) {
        state->soft_vref += config->soft_start_volts_per_tick;
        if (state->soft_vref >= config->vref) {
            state->soft_vref = config->vref;
            state->state = BUCK_STATE_RUN;
        }
    } else {
        state->soft_vref = config->vref;
    }

    voltage_error = state->soft_vref - input->vout;
    voltage_u = config->voltage_kp * voltage_error + state->voltage_integrator;
    state->current_reference = clampf(voltage_u, 0.0f, config->current_limit);

    if ((state->current_reference > 0.0f && state->current_reference < config->current_limit) ||
        (state->current_reference >= config->current_limit && voltage_error < 0.0f) ||
        (state->current_reference <= 0.0f && voltage_error > 0.0f)) {
        state->voltage_integrator += config->voltage_ki * voltage_error * dt;
        state->voltage_integrator = clampf(state->voltage_integrator, 0.0f, config->current_limit);
    }

    current_error = state->current_reference - input->iout;
    current_u = config->current_kp * current_error + state->current_integrator;
    duty_unsat = state->soft_vref / 48.0f + current_u;
    state->duty = clampf(duty_unsat, config->duty_min, config->duty_max);

    if ((state->duty > config->duty_min && state->duty < config->duty_max) ||
        (state->duty >= config->duty_max && current_error < 0.0f) ||
        (state->duty <= config->duty_min && current_error > 0.0f)) {
        state->current_integrator += config->current_ki * current_error * dt;
        state->current_integrator = clampf(state->current_integrator, -0.25f, 0.25f);
    }
}
