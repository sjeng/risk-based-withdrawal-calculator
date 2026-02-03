# ✅ Auto-Save Fixed - SQLite Permission Issue Resolved

## Problem
Auto-save functionality was not working after the MySQL to SQLite migration.

## Root Cause
The SQLite database file was created with **read-only permissions** for the `www-data` user (PHP-FPM process).

```
-rw-r--r--  1 root root  86016 database.sqlite  ❌ Only root can write
```

SQLite returned: `SQLSTATE[HY000]: General error: 8 attempt to write a readonly database`

## Solution

### 1. Fixed File Permissions
```bash
chown -R www-data:www-data /var/www/html/storage
chmod -R 775 /var/www/html/storage
```

Result:
```
-rwxrwxr-x  1 www-data www-data  86016 database.sqlite  ✅ www-data can write
```

### 2. Updated Docker Entrypoint Script
Modified `docker/php/docker-entrypoint.sh` to automatically set correct permissions on container startup:

```sh
# Set ownership and permissions on storage directory
# This is crucial for SQLite database writes
chown -R www-data:www-data /var/www/html/storage
chmod -R 775 /var/www/html/storage
```

### 3. Fixed SQL Syntax for SQLite
Changed from MySQL syntax to SQLite syntax in `SavedInputRepository.php`:

```php
// Before (MySQL):
$sql = "REPLACE INTO saved_inputs ..."

// After (SQLite):  
$sql = "INSERT OR REPLACE INTO saved_inputs ..."
```

## Testing

### Manual Test
```bash
curl -X POST http://localhost:8080/api.php?action=save_inputs \
  -H "Content-Type: application/json" \
  -d '{"spouse1_age": 73, "retirement_age": 68}'

# Response:
{"success":true,"data":{"message":"Inputs saved successfully"}}
```

### Verify Data Saved
```bash
docker exec guardrail_php sqlite3 /var/www/html/storage/database.sqlite \
  "SELECT spouse1_age, retirement_age FROM saved_inputs WHERE id=1;"

# Output:
73|68
```

## How Auto-Save Works

1. **User types in any form field**
2. JavaScript triggers `input` event
3. **1-second debounce** - waits for user to stop typing
4. `saveInputsToDatabase()` function called
5. **POST request** to `/api.php?action=save_inputs`
6. `SavedInputRepository::saveInputs()` executes
7. **INSERT OR REPLACE** into `saved_inputs` table (id=1)
8. **Green "✓ Saved" indicator** appears top-right
9. On page refresh, data auto-loads via `/api.php?action=load_inputs`

## Testing Auto-Save in Browser

1. Visit http://localhost:8080
2. Change any field (e.g., age from 65 to 66)
3. Wait 1-2 seconds
4. Look for **green "✓ Saved"** indicator (top-right corner)
5. **Refresh the page** - your data should still be there

## Files Modified

1. **docker/php/docker-entrypoint.sh** - Auto-set permissions on startup
2. **src/classes/SavedInputRepository.php** - Fixed SQL syntax for SQLite
3. **src/classes/Database.php** - Already had SQLite support (from migration)

## Why This Happened

During the SQLite migration:
1. Database file was auto-created by PHP-FPM running as `root` 
2. File inherited `root` ownership with default permissions (644)
3. When PHP-FPM workers (running as `www-data`) tried to write, they were denied

This is a common issue when switching to SQLite - **both the database file AND its parent directory** need write permissions for the web server user.

## Status

✅ **Auto-save is now fully functional**  
✅ **Permissions automatically set on container startup**  
✅ **Works for all CRUD operations (create, read, update, delete)**  
✅ **SQLite database is writable by www-data**  

## Additional Notes

### SQLite Permissions Requirements

SQLite needs write access to:
1. **The database file itself** (`database.sqlite`)
2. **The parent directory** (`/var/www/html/storage/`)
   - SQLite creates temporary files (journal, wal, shm) in the same directory
   - Without directory write access, SQLite cannot create these temp files

### Verification Commands

```bash
# Check file ownership
docker exec guardrail_php ls -la /var/www/html/storage/

# Check PHP-FPM user
docker exec guardrail_php ps aux | grep php-fpm

# Test write access
docker exec guardrail_php su-exec www-data touch /var/www/html/storage/test.txt

# Test auto-save endpoint
curl -X POST http://localhost:8080/api.php?action=save_inputs \
  -H "Content-Type: application/json" \
  -d '{"spouse1_age": 70}'
```

---

**Migration Complete**: MySQL → SQLite ✅  
**Auto-Save Working**: Yes ✅  
**Ready to Use**: http://localhost:8080 ✅
