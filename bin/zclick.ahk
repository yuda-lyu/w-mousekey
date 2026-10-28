CoordMode("Mouse", "Screen")
x     := A_Args[1]
y     := A_Args[2]
btn   := A_Args.Length >= 3 ? A_Args[3] : "Left"
count := A_Args.Length >= 4 ? Integer(A_Args[4]) : 1
Click(btn, x, y, count)
ExitApp()
