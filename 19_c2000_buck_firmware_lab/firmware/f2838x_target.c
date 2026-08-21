/*
 * F2838x target binding for the teaching lab.
 *
 * Truth boundary:
 * - driverlib timing/safety routing below is executable target code;
 * - ADC channel selection, divider/current-sense gains, CMPSS positive-input mux,
 *   PWM pin/gate polarity and comparator DAC threshold MUST be rebound and
 *   validated against the actual board before BOARD can be claimed PASS.
 */
#include "driverlib.h"
#include "device.h"
#include "buck_control.h"

#define CONTROL_EPWM_BASE       EPWM1_BASE
#define CONTROL_ADC_BASE        ADCA_BASE
#define CONTROL_ADCRESULT_BASE  ADCARESULT_BASE
#define CONTROL_CMPSS_BASE      CMPSS1_BASE
#define CONTROL_ADC_INT         ADC_INT_NUMBER1
#define CONTROL_SOC_VOUT        ADC_SOC_NUMBER0
#define CONTROL_SOC_VIN         ADC_SOC_NUMBER1
#define CONTROL_SOC_IL          ADC_SOC_NUMBER2
#define CONTROL_EVIDENCE_GPIO   31U
#define CONTROL_SWITCHING_HZ    100000UL
#define CONTROL_EPWMCLK_DIV     2UL
#define CONTROL_TBPRD           ((uint16_t)((DEVICE_SYSCLK_FREQ / CONTROL_EPWMCLK_DIV) / CONTROL_SWITCHING_HZ))
#define CONTROL_OCP_DAC_CODE    3000U
#define CONTROL_ADC_ACQPS       20U
#define CONTROL_ADC_FULL_SCALE  4095.0f
#define CONTROL_ADC_VREF        3.3f

/* Reference-lab scaling only. Replace from the board calibration record. */
#define VOUT_VOLTS_PER_ADC_V    5.0f
#define VIN_VOLTS_PER_ADC_V     20.0f
#define IL_ZERO_ADC_V           1.65f
#define IL_AMPS_PER_ADC_V       5.0f

typedef struct {
    volatile uint32_t sequence;
    volatile uint16_t enable;
    volatile uint16_t clear_fault;
} BuckCommandSlot;

typedef struct {
    BuckCommandSlot slots[2];
    volatile uint16_t active_slot;
} BuckCommandMailbox;

typedef struct {
    uint32_t sequence;
    uint16_t enable;
    uint16_t clear_fault;
} BuckCommandSnapshot;

static BuckControlConfig gConfig = {
    .vref = 12.0f,
    .current_limit = 8.0f,
    .duty_min = 0.0f,
    .duty_max = 0.90f,
    .voltage_kp = 0.30f,
    .voltage_ki = 100.0f,
    .current_kp = 0.02f,
    .current_ki = 500.0f,
    .control_period_s = 1.0f / (float)CONTROL_SWITCHING_HZ,
    .soft_start_volts_per_second = 240.0f,
    .ovp_threshold = 14.0f,
    .command_timeout_ticks = 500U
};

static BuckControlState gState;
static BuckCommandMailbox gCommand = {{{0U, 0U, 0U}, {0U, 0U, 0U}}, 0U};
static uint32_t gLastCommandSequence = 0U;
static volatile uint32_t gHardwareTripCount = 0U;

/*
 * The communication owner calls this only after a command frame passes its
 * own CRC/version/range checks. ADC ISR never manufactures freshness.
 */
void BuckTarget_publishCommand(uint16_t enable, uint16_t clear_fault)
{
    const uint16_t active = (uint16_t)(gCommand.active_slot & 1U);
    const uint16_t next = (uint16_t)(active ^ 1U);
    const uint32_t sequence = gCommand.slots[active].sequence + 1U;

    /*
     * Write the inactive slot completely, then publish it with one 16-bit
     * selector store. The ADC ISR never spins waiting for a pre-empted writer.
     */
    gCommand.slots[next].enable = enable ? 1U : 0U;
    gCommand.slots[next].clear_fault = clear_fault ? 1U : 0U;
    gCommand.slots[next].sequence = sequence;
    gCommand.active_slot = next;
}

static BuckCommandSnapshot commandSnapshot(void)
{
    BuckCommandSnapshot snapshot;
    const uint16_t active = (uint16_t)(gCommand.active_slot & 1U);
    snapshot.sequence = gCommand.slots[active].sequence;
    snapshot.enable = gCommand.slots[active].enable;
    snapshot.clear_fault = gCommand.slots[active].clear_fault;
    return snapshot;
}

static float adcCountsToVolts(uint16_t counts)
{
    return (float)counts * CONTROL_ADC_VREF / CONTROL_ADC_FULL_SCALE;
}

static float adcCountsToVout(uint16_t counts)
{
    return adcCountsToVolts(counts) * VOUT_VOLTS_PER_ADC_V;
}

static float adcCountsToVin(uint16_t counts)
{
    return adcCountsToVolts(counts) * VIN_VOLTS_PER_ADC_V;
}

static float adcCountsToIL(uint16_t counts)
{
    return (adcCountsToVolts(counts) - IL_ZERO_ADC_V) * IL_AMPS_PER_ADC_V;
}

static void configureEPWM(void)
{
    SysCtl_setEPWMClockDivider(SYSCTL_EPWMCLK_DIV_2);

    EPWM_setClockPrescaler(CONTROL_EPWM_BASE, EPWM_CLOCK_DIVIDER_1, EPWM_HSCLOCK_DIVIDER_1);
    EPWM_setTimeBaseCounterMode(CONTROL_EPWM_BASE, EPWM_COUNTER_MODE_STOP_FREEZE);
    EPWM_setTimeBaseCounter(CONTROL_EPWM_BASE, 0U);
    EPWM_setTimeBasePeriod(CONTROL_EPWM_BASE, CONTROL_TBPRD);

    EPWM_setCounterCompareValue(CONTROL_EPWM_BASE, EPWM_COUNTER_COMPARE_A, 0U);
    EPWM_setCounterCompareShadowLoadMode(CONTROL_EPWM_BASE, EPWM_COUNTER_COMPARE_A,
                                         EPWM_COMP_LOAD_ON_CNTR_ZERO);
    EPWM_setActionQualifierAction(CONTROL_EPWM_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_HIGH, EPWM_AQ_OUTPUT_ON_TIMEBASE_ZERO);
    EPWM_setActionQualifierAction(CONTROL_EPWM_BASE, EPWM_AQ_OUTPUT_A,
                                  EPWM_AQ_OUTPUT_LOW, EPWM_AQ_OUTPUT_ON_TIMEBASE_UP_CMPA);

    EPWM_setADCTriggerSource(CONTROL_EPWM_BASE, EPWM_SOC_A, EPWM_SOC_TBCTR_ZERO);
    EPWM_setADCTriggerEventPrescale(CONTROL_EPWM_BASE, EPWM_SOC_A, 1U);
    EPWM_enableADCTrigger(CONTROL_EPWM_BASE, EPWM_SOC_A);

    /* Fail closed until a fresh validated command explicitly grants authority. */
    EPWM_setTripZoneAction(CONTROL_EPWM_BASE, EPWM_TZ_ACTION_EVENT_TZA, EPWM_TZ_ACTION_LOW);
    EPWM_forceTripZoneEvent(CONTROL_EPWM_BASE, EPWM_TZ_FORCE_EVENT_OST);

    EPWM_setTimeBaseCounterMode(CONTROL_EPWM_BASE, EPWM_COUNTER_MODE_UP);
}

static void configureADC(void)
{
    ADC_setPrescaler(CONTROL_ADC_BASE, ADC_CLK_DIV_4_0);
    ADC_setMode(CONTROL_ADC_BASE, ADC_RESOLUTION_12BIT, ADC_MODE_SINGLE_ENDED);
    ADC_setInterruptPulseMode(CONTROL_ADC_BASE, ADC_PULSE_END_OF_CONV);
    ADC_enableConverter(CONTROL_ADC_BASE);
    DEVICE_DELAY_US(500U);

    ADC_setupSOC(CONTROL_ADC_BASE, CONTROL_SOC_VOUT, ADC_TRIGGER_EPWM1_SOCA, ADC_CH_ADCIN0, CONTROL_ADC_ACQPS);
    ADC_setupSOC(CONTROL_ADC_BASE, CONTROL_SOC_VIN, ADC_TRIGGER_EPWM1_SOCA, ADC_CH_ADCIN1, CONTROL_ADC_ACQPS);
    ADC_setupSOC(CONTROL_ADC_BASE, CONTROL_SOC_IL, ADC_TRIGGER_EPWM1_SOCA, ADC_CH_ADCIN2, CONTROL_ADC_ACQPS);
    ADC_setInterruptSource(CONTROL_ADC_BASE, CONTROL_ADC_INT, CONTROL_SOC_IL);
    ADC_clearInterruptStatus(CONTROL_ADC_BASE, CONTROL_ADC_INT);
    ADC_enableInterrupt(CONTROL_ADC_BASE, CONTROL_ADC_INT);
}

static void configureHardwareVeto(void)
{
    CMPSS_configHighComparator(CONTROL_CMPSS_BASE, CMPSS_INSRC_DAC);
    CMPSS_configDAC(CONTROL_CMPSS_BASE, CMPSS_DACREF_VDDA | CMPSS_DACVAL_SYSCLK);
    CMPSS_setDACValueHigh(CONTROL_CMPSS_BASE, CONTROL_OCP_DAC_CODE);
    CMPSS_configOutputsHigh(CONTROL_CMPSS_BASE,
                            CMPSS_TRIP_ASYNC_COMP | CMPSS_TRIPOUT_ASYNC_COMP);
    CMPSS_enableModule(CONTROL_CMPSS_BASE);

    XBAR_setEPWMMuxConfig(XBAR_TRIP4, XBAR_EPWM_MUX00_CMPSS1_CTRIPH);
    XBAR_enableEPWMMux(XBAR_TRIP4, XBAR_MUX00);
    EPWM_selectDigitalCompareTripInput(CONTROL_EPWM_BASE, EPWM_DC_TRIP_TRIPIN4, EPWM_DC_TYPE_DCAH);
    EPWM_setTripZoneDigitalCompareEventCondition(CONTROL_EPWM_BASE, EPWM_TZ_DC_OUTPUT_A1,
                                                 EPWM_TZ_EVENT_DCXH_HIGH);
    EPWM_setDigitalCompareEventSource(CONTROL_EPWM_BASE, EPWM_DC_MODULE_A, EPWM_DC_EVENT_1,
                                      EPWM_DC_EVENT_SOURCE_ORIG_SIGNAL);
    EPWM_setDigitalCompareEventSyncMode(CONTROL_EPWM_BASE, EPWM_DC_MODULE_A, EPWM_DC_EVENT_1,
                                        EPWM_DC_EVENT_INPUT_NOT_SYNCED);
    EPWM_enableTripZoneSignals(CONTROL_EPWM_BASE, EPWM_TZ_SIGNAL_DCAEVT1);
    EPWM_setTripZoneAction(CONTROL_EPWM_BASE, EPWM_TZ_ACTION_EVENT_TZA, EPWM_TZ_ACTION_LOW);
}

static void configureEvidenceGPIO(void)
{
    GPIO_setPadConfig(CONTROL_EVIDENCE_GPIO, GPIO_PIN_TYPE_STD);
    GPIO_setDirectionMode(CONTROL_EVIDENCE_GPIO, GPIO_DIR_MODE_OUT);
    GPIO_writePin(CONTROL_EVIDENCE_GPIO, 0U);
}

static void configureControlPipeline(void)
{
    SysCtl_disablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC);
    configureEPWM();
    configureADC();
    configureHardwareVeto();
    configureEvidenceGPIO();
    SysCtl_enablePeripheral(SYSCTL_PERIPH_CLK_TBCLKSYNC);
}

__interrupt void adca1ISR(void)
{
    BuckControlInput input;
    BuckCommandSnapshot command;
    uint16_t tzFlags;
    const uint16_t rawVout = ADC_readResult(CONTROL_ADCRESULT_BASE, CONTROL_SOC_VOUT);
    const uint16_t rawVin = ADC_readResult(CONTROL_ADCRESULT_BASE, CONTROL_SOC_VIN);
    const uint16_t rawIL = ADC_readResult(CONTROL_ADCRESULT_BASE, CONTROL_SOC_IL);

    GPIO_writePin(CONTROL_EVIDENCE_GPIO, 1U);
    command = commandSnapshot();

    input.vin = adcCountsToVin(rawVin);
    input.vout = adcCountsToVout(rawVout);
    input.iL = adcCountsToIL(rawIL);
    input.sensor_valid = 1U;
    input.enable_request = command.enable;
    input.command_heartbeat = (command.sequence != gLastCommandSequence) ? 1U : 0U;
    input.clear_fault_request = command.clear_fault;
    if (input.command_heartbeat) gLastCommandSequence = command.sequence;

    BuckControl_tick(&gConfig, &input, &gState);
    EPWM_setCounterCompareValue(CONTROL_EPWM_BASE, EPWM_COUNTER_COMPARE_A,
                                (uint16_t)(gState.duty * (float)CONTROL_TBPRD));

    tzFlags = EPWM_getTripZoneFlagStatus(CONTROL_EPWM_BASE);
    if ((tzFlags & EPWM_TZ_FLAG_DCAEVT1) != 0U) gHardwareTripCount++;

    if ((gState.state == BUCK_STATE_FAULT_LATCHED) || !input.enable_request) {
        EPWM_forceTripZoneEvent(CONTROL_EPWM_BASE, EPWM_TZ_FORCE_EVENT_OST);
    } else if (input.command_heartbeat) {
        /* Hardware DCAEVT1 remains authoritative and can immediately re-trip. */
        EPWM_clearTripZoneFlag(CONTROL_EPWM_BASE, EPWM_TZ_FLAG_OST);
    }

    if (input.clear_fault_request && gState.state == BUCK_STATE_OFF &&
        input.iL < gConfig.current_limit * 0.20f && input.vout < gConfig.vref * 0.50f) {
        EPWM_clearTripZoneFlag(CONTROL_EPWM_BASE,
                               EPWM_TZ_FLAG_OST | EPWM_TZ_FLAG_DCAEVT1);
    }

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

    /* GPIO0 is the reference-lab EPWM1A pin. Rebind in the board pinmux. */
    GPIO_setPinConfig(GPIO_0_EPWM1_A);
    configureControlPipeline();

    Interrupt_register(INT_ADCA1, &adca1ISR);
    Interrupt_enable(INT_ADCA1);
    EINT;
    ERTM;

    while (1) {
        /* Communication layer publishes validated commands via BuckTarget_publishCommand(). */
        NOP;
    }
}
