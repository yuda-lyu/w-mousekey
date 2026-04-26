CoordMode("Mouse", "Screen")
x      := A_Args[1]
y      := A_Args[2]
dir    := A_Args[3]
amount := A_Args.Length >= 4 ? Integer(A_Args[4]) : 3
dirMap := Map("up", "WheelUp", "down", "WheelDown", "left", "WheelLeft", "right", "WheelRight")
if !dirMap.Has(dir) {
    ExitApp(1)
}
Click(dirMap[dir], x, y, amount)
ExitApp()
