/*
 * F2838x target binding for the teaching lab.
 * Build with TI C2000Ware driverlib + TI CGT for the selected F2838xD CPU.
 */
#include "driverlib.h"
#include "device.h"
#include "buck_control.h"

#define CONTROL_EPWM_BASE       EPWM1_BASE
#define CONTROL_ADC_BASE        ADCA_BASE
#define CONTROL_ADCRESULT_BASE  ADCARESULT_BASE
#define CONTROL_CMPSS_BASE      CMPSS1_BASE
#define CONTROL_ADC_SOC         ADC_SOC_NUMBER0
#define CONTROL_ADC_INT         ADC_INT_NUMBER1
#define CONTROL_EVIDENCE_GPIO   31U
#define CONTROL_TBPRD           1000U
#define CONTROL_OCP_DAC_CODE    3000U

static BuckControlConfig gConfig = {
    .vref = 12.0f,
    .current_limit = 8.0f,
    .duty_min = 0.0f,
    .duty_max = 0.90f,
    .voltage_kp = 0.30f,
    .voltage_ki = 100.0f,
    .current_kp = 0.02f,
    .current_ki = 500.0f,
    .soft_start_volts_per_tick = 0.0024f,
    .ovp_threshold = 14.0f,
    .command_timeout_ticks = 500U
};

static BuckControlState gState;

static float adcCountsToVout(uint16_t counts)
{
    return ((float)counts * 3.3f / 4095.0f) * 5.0f;
}

static void configureControlPipeline(void)
{
    EPWM_setTimeBasePeriod(CONTROL_EPWM_BASE, CONTROL_TBPRD);
    EPWM_setADCTriggerSource(CONTROL_EPWM_BASE, EPWM_SOC_A, EPWM_SOC_TBCTR_ZERO);
    EPWM_setADCTriggerEventPrescale(CONTROL_EPWM_BASE, EPWM_SOC_A, 1U);
    EPWM_enableADCTrigger(CONTROL_EPWM_BASE, EPWM_SOC_A);

    ADC_setupSOC(CONTROL_ADC_BASE, CONTROL_ADC_SOC, ADC_TRIGGER_EPWM1_SOCA, ADC_CH_ADCIN0, 20U);
    ADC_setInterruptSource(CONTROL_ADC_BASE, CONTROL_ADC_INT, CONTROL_ADC_SOC);
    ADC_clearInterruptStatus(CONTROL_ADC_BASE, CONTROL_ADC_INT);
    ADC_enableInterrupt(CONTROL_ADC_BASE, CONTROL_ADC_INT);

    CMPSS_configHighComparator(CONTROL_CMPSS_BASE, CMPSS_INSRC_DAC);
    CMPSS_configDAC(CONTROL_CMPSS_BASE, CMPSS_DACREF_VDDA | CMPSS_DACVAL_SYSCLK);
    CMPSS_setDACValueHigh(CONTROL_CMPSS_BASE, CONTROL_OCP_DAC_CODE);
    CMPSS_enableModule(CONTROL_CMPSS_BASE);

    EPWM_selectDigitalCompareTripInput(CONTROL_EPWM_BASE, EPWM_DC_TRIP_TRIPIN4, EPWM_DC_TYPE_DCAH);
    EPWM_setTripZoneDigitalCompareEventCondition(CONTROL_EPWM_BASE, EPWM_TZ_DC_OUTPUT_A1, EPWM_TZ_EVENT_DCXH_HIGH);
    EPWM_enableTripZoneSignals(CONTROL_EPWM_BASE, EPWM_TZ_SIGNAL_DCAEVT1);
    EPWM_setTripZoneAction(CONTROL_EPWM_BASE, EPWM_TZ_ACTION_EVENT_TZA, EPWM_TZ_ACTION_LOW);

    GPIO_setPadConfig(CONTROL_EVIDENCE_GPIO, GPIO_PIN_TYPE_STD);
    GPIO_setDirectionMode(CONTROL_EVIDENCE_GPIO, GPIO_DIR_MODE_OUT);
}

__interrupt void adca1ISR(void)
{
    BuckControlInput input;
    const uint16_t raw = ADC_readResult(CONTROL_ADCRESULT_BASE, CONTROL_ADC_SOC);

    GPIO_writePin(CONTROL_EVIDENCE_GPIO, 1U);

    input.vout = adcCountsToVout(raw);
    input.iout = 0.0f; /* bind to the board current-sense channel in the exercise */
    input.sensor_valid = 1U;
    input.enable_request = 1U;
    input.command_heartbeat = 1U;
    input.clear_fault_request = 0U;

    BuckControl_tick(&gConfig, &input, &gState);
    EPWM_setCounterCompareValue(CONTROL_EPWM_BASE, EPWM_COUNTER_COMPARE_A,
                                (uint16_t)(gState.duty * (float)CONTROL_TBPRD));

    GPIO_writePin(CONTROL_EVIDENCE_GPIO, 0U);
    ADC_clearInterruptStatus(CONTROL_ADC_BASE, CONTROL_ADC_INT);
    Interrupt_clearACKGroup(INTERRUPT_ACK_GROUP1);
}

int main(void)
{
    Device_init();
    Device_initGPIO();
    Interrupt_initModule();
    Interrupt_initVectorTable();
    BuckControl_init(&gState);
    configureControlPipeline();
    Interrupt_register(INT_ADCA1, &adca1ISR);
    Interrupt_enable(INT_ADCA1);
    EINT;
    ERTM;
    EPWM_clearTripZoneFlag(CONTROL_EPWM_BASE, EPWM_TZ_FLAG_OST | EPWM_TZ_FLAG_DCAEVT1);

    while (1) {
        /* background: command freshness, controlled re-arm, telemetry and snapshots */
        NOP;
    }
}
