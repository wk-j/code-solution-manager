
var ref = require('ref');
var ffi = require('ffi');
var Struct = require('ref-struct');

var remote = require('electron').remote;

var _ = require('lodash');

var bindings, stringPtr, user32, voidPtr, windowProc;

voidPtr = ref.refType(ref.types["void"]);
stringPtr = ref.refType(ref.types.CString);

// typedef struct tagPOINT {
//   LONG x;
//   LONG y;
// } POINT, *PPOINT;

var POINT = Struct({
  'length': 'long',
  'flags': 'long',
});

// typedef struct _RECT {
//   LONG left;
//   LONG top;
//   LONG right;
//   LONG bottom;
// } RECT, *PRECT;

var RECT = Struct({
  'left': 'long',
  'top': 'long',
  'right': 'long',
  'bottom': 'long',
});

// typedef struct tagWINDOWPLACEMENT {
//   UINT  length;
//   UINT  flags;
//   UINT  showCmd;
//   POINT ptMinPosition;
//   POINT ptMaxPosition;
//   RECT  rcNormalPosition;
// } WINDOWPLACEMENT, *PWINDOWPLACEMENT, *LPWINDOWPLACEMENT;

var WINDOWPLACEMENT = Struct({
  'length': 'uint',
  'flags': 'uint',
  'showCmd': 'uint',
  'ptMinPosition': POINT,
  'ptMaxPosition': POINT,
  'rcNormalPosition': RECT,
});

var LPWINDOWPLACEMENT = ref.refType(WINDOWPLACEMENT);

bindings = 
{
    EnumWindows: ['bool', [voidPtr, 'int32']],
    GetWindowTextA: ['long', ['long'/*hwnd*/, stringPtr, 'long']],
    SetActiveWindow: ['long', ['long'/*hwnd*/]],
    ShowWindow: ['bool', ['long'/*hwnd*/, 'int32']],
    BringWindowToTop: ['bool', ['long'/*hwnd*/]],
    SetForegroundWindow: ['bool', ['long'/*hwnd*/]],
    GetWindowPlacement: ['bool', ['long'/*hwnd*/, LPWINDOWPLACEMENT/*lpwndpl*/]],
    SetWindowPos: ['bool', ['long'/*hwnd*/, 'long'/*hWndInsertAfter*/, 'int32'/*x*/, 'int32'/*y*/, 'int32'/*cx*/, 'int32'/*cy*/, 'uint32'/*uFlags*/]],
    GetActiveWindow: ['long'/*hwnd*/, []],
    SetFocus: ['long'/*hwnd*/, ['long'/*hwnd*/]],
    SetCapture: ['long'/*hwnd*/, ['long'/*hwnd*/]],
    EnableWindow: ['bool', ['long'/*hwnd*/, 'bool'/*enable*/]],
    GetWindowThreadProcessId: ['uint32', ['long'/*hwnd*/, 'uint32']],
    AttachThreadInput: ['bool', ['uint32'/*idAttach*/, 'uint32'/*idAttachTo*/, 'bool'/*fAttach*/]],
};

var k32_bindings = 
{
    GetCurrentThreadId: ['uint32', []],
};

user32 = ffi.Library('user32.dll', bindings);
var kernel32 = ffi.Library('kernel32.dll', k32_bindings);

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

var vs_code_window_suffix = ' - Visual Studio Code';
var content = document.getElementById('content');

var project_list = document.createElement('div');
content.appendChild(project_list);

var HWND_TOPMOST = -1;
var HWND_TOP = 0;

var SWP_NOSIZE = 1;
var SWP_NOMOVE = 2;

var SW_SHOWMINIMIZED = 2;
var SW_SHOW = 5;
var SW_RESTORE = 9;

// function _pinTopMost(hwnd)
// {
//     user32.SetWindowPos(hwnd,
//                 HWND_TOPMOST,
//                 0,
//                 0,
//                 0,
//                 0,
//                 SWP_NOMOVE|SWP_NOSIZE
//                 );
// }

function _closeWindowList()
{
    remote.getCurrentWindow().close();
}

function _hideWindowList()
{
    remote.getCurrentWindow().hide();
}

function _showVsCodeWindow(hwnd)
{
    // _hideWindowList();
    
    // var wnd_plcmt_ptr = ref.alloc(WINDOWPLACEMENT);
    // user32.GetWindowPlacement(hwnd, wnd_plcmt_ptr);
    // var wnd_plcmt = wnd_plcmt_ptr.deref();
    
    // // when the window is minimized then SW_RESTORE
    // if (wnd_plcmt.showCmd == SW_SHOWMINIMIZED)
    //     user32.ShowWindow(hwnd, SW_RESTORE);
    // // otherwise SW_SHOW
    // else
    //     user32.ShowWindow(hwnd, SW_SHOW);

    // // bring the window to front
    // user32.SetWindowPos(hwnd,
    //         HWND_TOP,
    //         0, 0, 0, 0,
    //         SWP_NOMOVE | SWP_NOSIZE
    //         );
            
    var curr_thread_id = kernel32.GetCurrentThreadId();
    var other_thread_id = user32.GetWindowThreadProcessId(hwnd, 0);
     
    if (other_thread_id == 0)
    {
        alert("Error: target thread id could not be determined");
        return;
    }
     
    if (other_thread_id != curr_thread_id)
    {
        user32.AttachThreadInput(curr_thread_id, other_thread_id, 1);
    }

    user32.SetActiveWindow(hwnd);

    if (other_thread_id != curr_thread_id)
    {
        user32.AttachThreadInput(curr_thread_id, other_thread_id, 0);
    }
                
    // NOTE: this causes correct activation of the window (replaces SetWindowPos)
    // but it makes the window flash in the taskbar (Windows 10)
    // user32.BringWindowToTop(hwnd);
    // user32.SetForegroundWindow(hwnd);
    
    // user32.SetForegroundWindow(hwnd);
    // user32.SetCapture(hwnd);
    // user32.SetFocus(hwnd);
    // user32.SetActiveWindow(hwnd);
    // user32.EnableWindow(hwnd, true);
    
    _closeWindowList();
}

var windows = [];

windowProc = ffi.Callback('bool', ['long', 'int32'], function(hwnd, lParam)
{
    var buf, window_name, ret;
    buf = new Buffer(255);
    ret = user32.GetWindowTextA(hwnd, buf, 255);
    window_name = ref.readCString(buf, 0);

    if (!window_name || !window_name.length || !endsWith(window_name, vs_code_window_suffix))
        return true;

    var separator = ' - ';
    var prefix_sep_pos = window_name.indexOf(separator);
    var suffix_sep_pos = window_name.lastIndexOf(separator);

    var win = 
    {
        window_name: window_name,
        project_name: window_name,
        file_name: '',
        hwnd: hwnd,
    };
        
    if (prefix_sep_pos >= 0)
    {
        if (prefix_sep_pos == suffix_sep_pos)
        {
            // only file name in the window title, no project name
            win.project_name = "Untitled project";
            win.file_name = window_name.substr(0, prefix_sep_pos);
        }
        else if (suffix_sep_pos >= 0)
        {
            // file + project name in the window title
            win.project_name = window_name.substring(prefix_sep_pos + separator.length, suffix_sep_pos);
            win.file_name = window_name.substr(0, prefix_sep_pos);
        }
    }
    
    windows.push(win);
    return true;
});

function _refreshWindowList()
{
    // clear data list
    windows = [];
    
    // clear DOM list
    while (project_list.firstChild)
        project_list.removeChild(project_list.firstChild);

    // fetch list from windows
    user32.EnumWindows(windowProc, 0);

    // sort by project name
    windows = _.sortBy(windows, function(e) { return e.project_name.toLowerCase(); });

    for (var win of windows)
    {
        var project_li = document.createElement('div');
        var project_href = document.createElement('div');
        var project_icon = document.createElement('img');
        
        project_href.classList.add('row');
        
        project_icon.src = './folder-outline.png';
        project_icon.width = 24;
        project_icon.classList.add('icon');
        project_href.appendChild(project_icon);
        
        project_li.setAttribute('onclick', 'javascript:_showVsCodeWindow(' + win.hwnd + ')');
        project_li.setAttribute('onmouseover', 'javascript:onHover(this);')
                
        var project_text = document.createElement('div');
        project_text.innerHTML = win.project_name;
        project_text.classList.add('project');
        
        var file_text = document.createElement('div');
        file_text.innerHTML = ' > ' + win.file_name;
        file_text.classList.add('file');

        project_href.appendChild(project_text);
        project_href.appendChild(file_text);

        project_li.appendChild(project_href);
        project_list.appendChild(project_li);
    }

    if (project_list.children.length > 0)
        project_list.children[0].classList.add('active');
}

function onHover(list_elem)
{
    if (!project_list)
        return;
        
    for (var idx in project_list.children)
    {
        var li = project_list.children[idx];
                
        if (li == list_elem)
        {
            li.classList.add('active');
        }
        else if (li.classList)
        {
            li.classList.remove('active');
        }
    }
}

document.addEventListener("keydown", onKeyDown, false);

function onKeyDown(e)
{
    var keyCode = e.keyCode;

    switch (keyCode)
    {
        // Enter
        case 13:
        {
            for (var idx in project_list.children)
            {
                var li = project_list.children[idx];
                        
                if (li.classList && li.classList.contains('active'))
                {
                    var win = windows[idx];
                    _showVsCodeWindow(win.hwnd);
                    return;
                }
            }
        }
        break;
        
        // Escape
        case 27:
        {
            _closeWindowList();
            // _hideWindowList();
        }
        break;
        
        // Up
        case 38:
        {
            var items = [].slice.call(project_list.children);
            var active_index = _.findIndex(items, function(e) { return e.classList && e.classList.contains('active'); });
            
            if (active_index > 0)
            {
                items[active_index].classList.remove('active');
                items[active_index-1].classList.add('active');
            }
        }
        break;
        
        // Down
        case 40:
        {
            var items = [].slice.call(project_list.children);
            var active_index = _.findIndex(items, function(e) { return e.classList && e.classList.contains('active'); });
            
            if (active_index < items.length-1)
            {
                items[active_index].classList.remove('active');
                items[active_index+1].classList.add('active');
            }
        }
        break;
    }
}
