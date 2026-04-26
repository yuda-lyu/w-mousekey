CoordMode("Mouse", "Screen")
x1  := A_Args[1]
y1  := A_Args[2]
x2  := A_Args[3]
y2  := A_Args[4]
btn := A_Args.Length >= 5 ? A_Args[5] : "Left"
MouseClickDrag(btn, x1, y1, x2, y2, 100)
Click(btn, x2, y2) ;click for stop
ExitApp()
