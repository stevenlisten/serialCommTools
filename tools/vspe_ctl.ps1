# VSPE 仿真控制（评估版）：对主窗口发送 WM_COMMAND 启动/停止仿真
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\vspe_ctl.ps1 -Action stop|start
# 命令 ID 经本机菜单枚举实证：32803=启动仿真 32804=停止仿真
param([Parameter(Mandatory=$true)][ValidateSet("stop","start")][string]$Action)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class VspeCtl {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  public delegate bool EnumProc(IntPtr h, IntPtr lp);
}
"@
$target = [IntPtr]::Zero
$cb = [VspeCtl+EnumProc]{ param($h,$l)
  $t = New-Object System.Text.StringBuilder 256
  [VspeCtl]::GetWindowText($h,$t,256) | Out-Null
  if ($t.ToString() -match "Virtual Serial Ports Emulator") { $script:target = $h; return $false }
  return $true
}
[VspeCtl]::EnumWindows($cb,[IntPtr]::Zero) | Out-Null
if ($target -eq [IntPtr]::Zero) { Write-Error "VSPE 主窗口未找到"; exit 1 }
$cmd = if ($Action -eq 'stop') { 32804 } else { 32803 }
[VspeCtl]::PostMessage($target, 0x0111, [IntPtr]$cmd, [IntPtr]::Zero) | Out-Null
Write-Host "VSPE $Action sent (cmd=$cmd)"
