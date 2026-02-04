# Bug Fix: Inflation Adjusted Field Not Saving/Loading Correctly

## Issue Description
The "Inflation Adjusted?" field under Income Sources was not correctly loading saved values. When users selected "No" for inflation adjustment, the value would not persist after page reload and would always revert to "Yes".

## Root Cause
SQLite stores boolean values as integers (0 for false, 1 for true). When loading data from the database, JavaScript was receiving `0` or `1` instead of `true` or `false`.

The original code used this comparison:
```javascript
const inflationAdjusted = savedData?.is_inflation_adjusted !== false;
```

This logic failed because:
- When the database value was `0` (meaning "No/false"), the expression `0 !== false` evaluates to `true` in JavaScript (since `0` is not strictly equal to `false`)
- This caused the field to always default to "Yes" even when "No" was saved

## The Fix
**File**: `src/public/js/app.js` (line 111)

**Changed from:**
```javascript
const inflationAdjusted = savedData?.is_inflation_adjusted !== false;
```

**Changed to:**
```javascript
// Convert SQLite integer (0/1) or boolean to proper boolean, defaulting to true
const inflationAdjusted = savedData?.is_inflation_adjusted == null ? true : Boolean(savedData.is_inflation_adjusted);
```

## How It Works
The new logic:
1. First checks if the value is `null` or `undefined` (no saved data) → defaults to `true` (Yes)
2. If a value exists, converts it to a proper boolean using `Boolean()`:
   - `Boolean(0)` → `false` (No)
   - `Boolean(1)` → `true` (Yes)
   - `Boolean(true)` → `true` (for future-proofing)
   - `Boolean(false)` → `false` (for future-proofing)

## Testing
To verify the fix:
1. Add an income source and set "Inflation Adjusted?" to "No"
2. Refresh the page
3. Verify the field now correctly shows "No" instead of reverting to "Yes"
4. Test with "Yes" as well to ensure it still works correctly

## Date Fixed
2025-01-XX
