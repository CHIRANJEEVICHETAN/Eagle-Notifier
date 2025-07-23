## Alarms That Needs to extracted from the database.

### **1. Temperature & Setpoints**  
- **`hz1sv`**: Hardening Zone 1 **Set Value** (e.g., setpoint: 880°C)  
- **`hz1pv`**: Hardening Zone 1 **Present Value** (e.g., live temperature reading: 882°C)  
- **`hz2sv`**: Hardening Zone 2 **Set Value**  
- **`hz2pv`**: Hardening Zone 2 **Present Value**  
- **`cpsv`**: Carbon Potential **Set Value** (e.g., 0.40%)  
- **`cppv`**: Carbon Potential **Present Value** (e.g., 0.39%)  
- **`tz1sv`**: Tempering Zone 1 **Set Value**  
- **`tz1pv`**: Tempering Zone 1 **Present Value**  
- **`tz2sv`**: Tempering Zone 2 **Set Value**  
- **`tz2pv`**: Tempering Zone 2 **Present Value** 
- **`oilpv`**: Oil **Present Value** (generic oil parameter)   

---

### **4. Oil System Alarms**  
- **`oiltemphigh`**: Oil Temperature High Alarm (threshold: 80°C)  // No lower limit
- **`oillevelhigh`**: Oil Level High Alarm  
- **`oillevellow`**: Oil Level Low Alarm  

---

### **5. Equipment Failures/Trips**  
- **`hz1hfail`**: Hardening Zone 1 **Heater Failure**  
- **`hz2hfail`**: Hardening Zone 2 **Heater Failure**  
- **`hardconfail`**: Hardening **Conveyor Failure**  
- **`hardcontraip`**: Hardening Conveyor **Trip**  
- **`oilconfail`**: Oil **Conveyor Failure**  
- **`oilcontraip`**: Oil Conveyor **Trip**  
- **`hz1fanfail`**: Hardening Zone 1 **Fan Failure**  
- **`hz2fanfail`**: Hardening Zone 2 **Fan Failure**  
- **`hz1fantrip`**: Hardening Zone 1 Fan **Trip**  
- **`hz2fantrip`**: Hardening Zone 2 Fan **Trip**  
- **`tempconfail`**: Tempering **Conveyor Failure**  
- **`tempcontraip`**: Tempering Conveyor **Trip**  
- **`tz1fanfail`**: Tempering Zone 1 **Fan Failure**  
- **`tz2fanfail`**: Tempering Zone 2 **Fan Failure**  
- **`tz1fantrip`**: Tempering Zone 1 Fan **Trip**  
- **`tz2fantrip`**: Tempering Zone 2 Fan **Trip**  

---

### **7. Metadata**  
- **`id`**: Unique Record Identifier  
- **`created_timestamp`**: Timestamp of Record Creation  

---

### **Key Observations**  
- **`sv` = Set Value** (configured setpoint).  
- **`pv` = Present Value** (real-time measurement).  
- **`fail`** denotes equipment failure, while **`trip`** indicates an automatic shutdown. 