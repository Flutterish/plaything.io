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
            },
            mapRequests: () => {
                return {
                    request: (data) => {
                        return new Promise((res, rej) => {
                            data.id = id;
                            callbacks[id++] = [res, rej];
                            worker.postMessage(data);
                        });
                    },
                };
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
function requestAsync(path) {
    return new Promise((res, rej) => {
        request(path, res);
    });
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
}).mapRequests();
window.addEventListener('load', () => {
    request('login.part', res => {
        var state = { type: 'login', html: res };
        window.history.pushState(state, '', 'login');
        loadPage(state);
    });
    request('wrapper.part', res => {
        loadWrapper(res);
    });
});
function createTemplate(data) {
    var root = document.createElement('div');
    root.innerHTML = data;
    return root;
}
var loginPage = undefined;
var wrapper = undefined;
var optionsOverlay = undefined;
var isOverlayInDom = false;
var isOverlayOpen = false;
function loadPage(state) {
    if (state.type == 'login') {
        loadLoginPage(state);
    }
}
async function loadLoginPage(state) {
    var template = createTemplate(state.html);
    var passLabel = template.querySelector('#pass-label');
    var nickLabel = template.querySelector('#nickname-label');
    var pass = template.querySelector('#pass');
    var nick = template.querySelector('#nickname');
    var submit = template.querySelector('#login');
    var messages = template.querySelector('#info');
    loginPage = template.childNodes[0];
    document.body.appendChild(loginPage);
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
    submit.onclick = async () => {
        var nickname = nick.value;
        var password = pass.value;
        var res = await sockets.request({
            type: 'login',
            nickname: nickname,
            password: password
        });
        if (res.result == 'ok') {
            messages.innerHTML = `
                <i class="fa-solid fa-skull"></i>
                Poggers
            `;
            localStorage.setItem('session_key', res.sessionKey);
        }
        else {
            messages.innerHTML = `
                <i class="fa-solid fa-skull"></i>
                <div>Could not log in</div>
            `;
            if (res.reason == 'nickname and password required') {
                messages.innerHTML += '<label for="nickname">The <abbr>nickname</abbr> field is required</label>';
                messages.innerHTML += '<label for="pass">The <abbr>password</abbr> field is required</label>';
            }
            else if (res.reason == 'nickname required') {
                messages.innerHTML += '<label for="nickname">The <abbr>nickname</abbr> field is required</label>';
            }
            else if (res.reason == 'password required') {
                messages.innerHTML += '<label for="pass">The <abbr>password</abbr> field is required</label>';
            }
            else if (res.reason == 'invalid credentials') {
                messages.innerHTML += '<div>Invalid credentials</div>';
            }
        }
    };
    nick.onkeydown = pass.onkeydown = e => {
        if (e.key.toLowerCase() == 'enter') {
            e.preventDefault();
            submit.click();
        }
    };
}
function loadWrapper(html) {
    var template = createTemplate(html);
    var optionsButton = template.querySelector('#options-button');
    wrapper = template.childNodes[0];
    document.body.appendChild(wrapper);
    optionsButton.addEventListener('click', openOptionsOverlay);
}
async function openOptionsOverlay() {
    if (optionsOverlay == undefined) {
        var template = createTemplate(await requestAsync('optionsOverlay.part'));
        optionsOverlay = template.childNodes[0];
        optionsOverlay.addEventListener('click', e => {
            if (e.target != optionsOverlay)
                return;
            closeOptionsOverlay();
        });
        window.addEventListener('keydown', e => {
            if (isOverlayOpen && e.key.toLowerCase() == 'escape') {
                closeOptionsOverlay();
            }
        });
    }
    if (!isOverlayInDom) {
        document.body.appendChild(optionsOverlay);
        isOverlayInDom = true;
    }
    if (!isOverlayOpen) {
        isOverlayOpen = true;
        setTimeout(() => optionsOverlay?.classList.add('open'), 1);
    }
}
function closeOptionsOverlay() {
    if (!isOverlayOpen)
        return;
    isOverlayOpen = false;
    setTimeout(() => optionsOverlay?.classList.remove('open'), 1);
}
