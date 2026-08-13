# Task Scheduler Setup

The `ForgeOSBrainConsole` task currently points to `launch.cmd`.

## Update it manually

1. Open **Task Scheduler** (`taskschd.msc`)
2. Find **ForgeOSBrainConsole** → right-click → **Properties**
3. On the **Actions** tab, click **Edit**
4. Change **Program/script** to:
   ```
   C:\Projects\ForgeOS\apps\brain-console\scripts\start-server.bat
   ```
5. Set **Start in** to:
   ```
   C:\Projects\ForgeOS\apps\brain-console
   ```
6. Click **OK** and enter your password if prompted

The wrapper script will automatically kill stale Node processes on `:7777` before starting the server.
