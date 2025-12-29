# FDI World Dental Federation Numbering System

## Complete Adult Human Dentition (32 Permanent Teeth)

The FDI (Fédération Dentaire Internationale) system uses a two-digit numbering scheme where:
- **First digit** = Quadrant number (1-4)
- **Second digit** = Tooth position within quadrant (1-8, from center to back)

---

## Visual Layout

```
UPPER JAW (Maxilla)
===================

Right Side          Midline          Left Side
-----------         -------          ----------
18 17 16 15 14 13 12 11  |  21 22 23 24 25 26 27 28
 8  7  6  5  4  3  2  1  |   1  2  3  4  5  6  7  8

Quadrant 1 (Upper Right)          Quadrant 2 (Upper Left)


                    | R  L |
              ===== MIDLINE =====


Quadrant 4 (Lower Right)          Quadrant 3 (Lower Left)

 8  7  6  5  4  3  2  1  |   1  2  3  4  5  6  7  8
48 47 46 45 44 43 42 41  |  31 32 33 34 35 36 37 38

Right Side          Midline          Left Side
-----------         -------          ----------

LOWER JAW (Mandible)
====================
```

---

## Quadrant Breakdown

### **Quadrant 1: Upper Right (11-18)**
- **11** - Central Incisor (UR1)
- **12** - Lateral Incisor (UR2)
- **13** - Canine (UR3)
- **14** - First Premolar (UR4)
- **15** - Second Premolar (UR5)
- **16** - First Molar (UR6)
- **17** - Second Molar (UR7)
- **18** - Third Molar / Wisdom Tooth (UR8)

### **Quadrant 2: Upper Left (21-28)**
- **21** - Central Incisor (UL1)
- **22** - Lateral Incisor (UL2)
- **23** - Canine (UL3)
- **24** - First Premolar (UL4)
- **25** - Second Premolar (UL5)
- **26** - First Molar (UL6)
- **27** - Second Molar (UL7)
- **28** - Third Molar / Wisdom Tooth (UL8)

### **Quadrant 3: Lower Left (31-38)**
- **31** - Central Incisor (LL1)
- **32** - Lateral Incisor (LL2)
- **33** - Canine (LL3)
- **34** - First Premolar (LL4)
- **35** - Second Premolar (LL5)
- **36** - First Molar (LL6)
- **37** - Second Molar (LL7)
- **38** - Third Molar / Wisdom Tooth (LL8)

### **Quadrant 4: Lower Right (41-48)**
- **41** - Central Incisor (LR1)
- **42** - Lateral Incisor (LR2)
- **43** - Canine (LR3)
- **44** - First Premolar (LR4)
- **45** - Second Premolar (LR5)
- **46** - First Molar (LR6)
- **47** - Second Molar (LR7)
- **48** - Third Molar / Wisdom Tooth (LR8)

---

## Tooth Types by Position (Last Digit)

| Last Digit | Tooth Type | Count per Quadrant |
|------------|------------|-------------------|
| **1** | Central Incisor | 1 |
| **2** | Lateral Incisor | 1 |
| **3** | Canine | 1 |
| **4** | First Premolar | 1 |
| **5** | Second Premolar | 1 |
| **6** | First Molar | 1 |
| **7** | Second Molar | 1 |
| **8** | Third Molar (Wisdom) | 1 |

---

## Key Advantages of FDI System

1. **Universal Standard**: Used internationally in most countries
2. **Logical Structure**: Quadrant + position makes it easy to remember
3. **Unambiguous**: Each tooth has a unique two-digit number
4. **Systematic**: Easy to determine tooth type from last digit
5. **Digital-Friendly**: Easy to input and store in dental software

---

## Implementation in Code

```javascript
// FDI tooth arrays for display (right to left for proper visual arrangement)
const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Get tooth type from FDI number
const getToothType = (fdiNumber) => {
  const lastDigit = fdiNumber % 10;
  if (lastDigit === 1) return 'central-incisor';
  if (lastDigit === 2) return 'lateral-incisor';
  if (lastDigit === 3) return 'canine';
  if (lastDigit === 4 || lastDigit === 5) return 'premolar';
  return 'molar'; // 6, 7, 8
};
```

---

## Sample Clinical Notes

**Example 1**: Patient has a cavity on tooth **16** (Upper Right First Molar)
**Example 2**: Tooth **46** (Lower Right First Molar) requires root canal treatment
**Example 3**: Tooth **21** (Upper Left Central Incisor) has composite filling
**Example 4**: Wisdom tooth **38** (Lower Left Third Molar) is impacted and needs extraction

---

✅ **This numbering system is now implemented in the Ultra-Realistic Dental Chart component!**



