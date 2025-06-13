## ⚡ `meter_readings` Table

Stores periodic electrical meter readings, including voltage, current, power factor, frequency, and energy metrics.

---

### 🔧 Sequence

The `meter_seq` sequence drives the numeric suffix for each new `meter_id`. On each insert, `nextval('meter_seq')` is fetched, zero‑padded to three digits, and concatenated with the fixed prefix:

```sql
CREATE SEQUENCE meter_seq
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO CYCLE;
```

### 🧱 Columns

| Column     | Type                    | Nullable | Default                                                                                           | Description                                      |
|------------|-------------------------|----------|---------------------------------------------------------------------------------------------------|--------------------------------------------------|
| `meter_id` | character varying(20)   | ❌       | `('Ennar'::text || lpad(nextval('meter_seq'::regclass)::text, 3, '0'::text))`                     | Unique meter identifier (prefixed “Ennar”)      |
| `voltage`  | real                    | ❌       | —                                                                                                 | Measured voltage (Volts)                        |
| `current`  | real                    | ❌       | —                                                                                                 | Measured current (Amperes)                      |
| `frequency`| real                    | ❌       | —                                                                                                 | Supply frequency (Hertz)                        |
| `pf`       | real                    | ❌       | —                                                                                                 | Power factor (unitless, −1 to 1)                |
| `energy`   | real                    | ❌       | —                                                                                                 | Instantaneous energy reading (Watts)            |
| `power`      | real                    | ❌       | —                                                                                                 | Cumulative energy (kilowatt-hours)              |

---

### 🔑 Primary Key

- `meter_readings_pkey` on (`meter_id`)

---

### ✅ Check Constraints

- `meter_readings_voltage_check`: `voltage >= 0`  
- `meter_readings_current_check`: `current >= 0`  
- `meter_readings_frequency_check`: `frequency > 0`  
- `meter_readings_pf_check`: `pf BETWEEN -1 AND 1`  
- `meter_readings_energy_check`: `energy >= 0`  
- `meter_readings_kwh_check`: `kwh >= 0`  

---
