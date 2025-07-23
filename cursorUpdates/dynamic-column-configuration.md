# Dynamic Column Configuration Enhancement

## Overview
Enhanced the auto-generation logic in OrganizationManagement component to intelligently detect and configure both analog and binary columns based on specific naming patterns, providing accurate SCADA column configurations.

## Implementation Details

### Enhanced Auto-Generation Logic
- **Analog Temperature Detection**: Uses regex patterns to detect zone-based temperature columns (hz1sv, hz1pv, tz2sv, tz2pv)
- **Zone Detection**: Automatically identifies hardening (hz) and tempering (tz) zones with proper zone numbering
- **Carbon Potential**: Handles both setpoint (cpsv) and process value (cppv) with appropriate units and deviations
- **Oil Temperature**: Configures oilpv as analog temperature with specific deviation ranges
- **Binary Alarms**: Detects various binary alarm types including:
  - Oil temperature/level alarms (oiltemphigh, oillevelhigh, oillevellow)
  - Heater failures (hz1hfail, hz2hfail)
  - Conveyor failures/trips (hardconfail, hardcontraip, oilconfail, oilcontraip)
  - Fan failures/trips for both hardening and tempering zones
  - Temperature controller failures/trips

### Column Type Detection Patterns

#### Analog Columns
```typescript
// Temperature zones with setpoint/process value
/^(hz|tz)\d+(sv|pv)$/  // hz1sv, hz1pv, tz2sv, tz2pv

// Carbon potential
/^cp[sp]v$/  // cpsv, cppv

// Oil temperature
oilpv
```

#### Binary Columns
```typescript
// Oil alarms
oiltemphigh, oillevelhigh, oillevellow

// Heater failures
/^hz\d+hfail$/  // hz1hfail, hz2hfail

// Conveyor failures/trips
hardconfail, hardcontraip, oilconfail, oilcontraip

// Fan failures/trips (hardening)
/^hz\d+fanfail$/, /^hz\d+fantrip$/

// Fan failures/trips (tempering)
/^tz\d+fanfail$/, /^tz\d+fantrip$/

// Temperature controller
tempconfail, tempcontraip
```

### Configuration Structure
Each column configuration includes:
- **name**: Human-readable display name
- **type**: Alarm type (temperature, carbon, heater, fan, conveyor, controller, level)
- **zone**: Zone identifier for zone-specific alarms (zone1, zone2)
- **unit**: Unit of measurement for analog values (°C, %)
- **isAnalog**: Boolean flag for analog alarms
- **isBinary**: Boolean flag for binary alarms
- **lowDeviation/highDeviation**: Deviation thresholds for analog alarms

### Example Generated Configuration
```json
{
    "hz1sv": {
      "name": "HARDENING ZONE 1 SETPOINT",
      "type": "temperature",
      "zone": "zone1",
      "unit": "°C",
    "isAnalog": true,
    "isBinary": false,
    "lowDeviation": -30.0,
    "highDeviation": 10.0
  },
  "hz1hfail": {
    "name": "HARDENING ZONE 1 HEATER FAILURE",
    "type": "heater",
      "zone": "zone1", 
    "isAnalog": false,
      "isBinary": true
  }
}
```

## Affected Components
- `app/components/OrganizationManagement.tsx` - Main component with enhanced auto-generation logic

## Performance Optimizations
- Uses regex patterns for efficient column name matching
- Minimizes string operations with direct pattern matching
- Maintains existing validation and error handling

## User Experience Improvements
- More accurate auto-generated configurations
- Proper distinction between analog and binary alarms
- Zone-aware naming for better organization
- Appropriate units and deviation ranges for different alarm types

## Future Enhancements
- Support for additional column patterns
- Customizable deviation ranges per organization
- Template-based configuration generation
- Import/export of configuration templates 