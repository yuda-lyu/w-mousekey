CoordMode("Mouse", "Screen")
x1 := A_Args[1]
y1 := A_Args[2]
x2 := A_Args[3]
y2 := A_Args[4]
MouseClickDrag("Left", x1, y1, x2, y2, 100)
ExitApp()
