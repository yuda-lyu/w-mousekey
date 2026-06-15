#NoTrayIcon
#SingleInstance Force
CoordMode "Mouse", "Screen"
Loop {
    if GetKeyState("LButton", "P") {
        MouseGetPos &x, &y
        FileAppend "Click " x " " y "\`n", "*"
        KeyWait "LButton"
    }
    Sleep 10
}