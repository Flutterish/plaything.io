export const Workers = {
    get: (name, defaultHandler) => {
        var worker = new Worker(name);
        var callbacks = {};
        var id = 0;
        worker.onmessage = msg => {
            if (msg.data.id == undefined || callbacks[msg.data.id] == undefined) {
                defaultHandler?.(msg.data);
            }
            else {
                callbacks[msg.data.id][0](msg.data);
                delete callbacks[msg.data.id];
            }
        };
        worker.onerror = msg => {
            console.error(msg);
        };
        worker.onmessageerror = msg => {
            console.error(msg);
        };
        return {
            request: (data) => {
                return new Promise((res, rej) => {
                    data.id = id;
                    callbacks[id++] = [res, rej];
                    worker.postMessage(data);
                });
            }
        };
    }
};
function request(path, cb) {
    const request = new XMLHttpRequest();
    request.onload = function () {
        cb(this.responseText);
    };
    request.open('GET', path, true);
    request.send();
}
var flexFont = function () {
    for (const div of document.getElementsByClassName('font-icon')) {
        var style = window.getComputedStyle(div);
        var height = Number.parseFloat(style.height);
        var pt = Number.parseFloat(style.paddingTop);
        var pb = Number.parseFloat(style.paddingBottom);
        div.style.fontSize = (height - pt - pb) + 'px';
    }
};
window.addEventListener('load', flexFont);
window.addEventListener('resize', flexFont);
const sockets = Workers.get('WebWorkers/Socket.js', heartbeat => {
});
window.addEventListener('load', () => {
    request('login.part', res => {
        var state = { type: 'login', html: res };
        window.history.pushState(state, '', 'login');
        loadPage(state);
    });
});
function loadPage(state) {
    if (state.type == 'login') {
        loadLoginPage(state);
    }
}
async function loadLoginPage(state) {
    document.body.innerHTML = state.html;
    var passLabel = document.getElementById('pass-label');
    var nickLabel = document.getElementById('nickname-label');
    var pass = document.getElementById('pass');
    var nick = document.getElementById('nickname');
    var info = await sockets.request({ type: 'loginInformation' });
    if (info.anonymousAllowed) {
        passLabel.setAttribute('title', 'Password is not required. You can log in anonymously with a blank password');
    }
    else {
        passLabel.innerText += '*';
        passLabel.setAttribute('title', 'Password is required');
    }
    nickLabel.innerText += '*';
    nickLabel.setAttribute('title', 'Nickname is required');
}
