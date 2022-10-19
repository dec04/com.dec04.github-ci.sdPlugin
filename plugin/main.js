let websocket = null;
let pluginUUID = null;

let DestinationEnum = Object.freeze({ 'HARDWARE_AND_SOFTWARE': 0, 'HARDWARE_ONLY': 1, 'SOFTWARE_ONLY': 2 });

const GITHUB_API_URL = 'https://api.github.com/repos';
const GITHUB_WORKFLOWS_PATH = 'actions/workflows';

let xhr = new XMLHttpRequest();
let periodTimer;
let periodInterval;
let timerFlag = false;
let githubToken = '';
const Status = {
    COMPLETED:       'completed',
    ACTION_REQUIRED: 'action_required',
    CANCELLED:       'cancelled',
    FAILURE:         'failure',
    NEUTRAL:         'neutral',
    SKIPPED:         'skipped',
    STALE:           'stale',
    SUCCESS:         'success',
    TIMED_OUT:       'timed_out',
    IN_PROGRESS:     'in_progress',
    QUEUED:          'queued',
    REQUESTED:       'requested',
    WAITING:         'waiting'
};

/**
 * Main action, describe all functions for work with Stream Deck SDK and GitHub API;
 * @type {{onKeyDown: githubCIAction.onKeyDown, onKeyUp: githubCIAction.onKeyUp, setLastError: githubCIAction.setLastError, setTitle: ((function(*=, *=): Promise<void>)|*), fetchWorkflow: ((function(*=, *=): Promise<void>)|*), setSettings: githubCIAction.setSettings, setRepoName: ((function(*=, *): Promise<void>)|*), onWillDisappear: githubCIAction.onWillDisappear, setState: ((function(*=, *=): Promise<void>)|*), onWillAppear: ((function(*=, *=, *): Promise<void>)|*), checkBeforeRequest: ((function(*=, *=, *): Promise<boolean>)|*), fetchWorkflows: githubCIAction.fetchWorkflows, sendRequest: githubCIAction.sendRequest}}
 */
let githubCIAction = {

    type: 'com.dec04.github-ci.action',

    /**
     * Method describe key down logic
     * @param context action context;
     * @param settings action settings;
     * @param coordinates event coordinates;
     * @param userDesiredState Only set when the action is triggered with a specific value from a Multi-Action.
     * For example, if the user sets the Game Capture Record action to be disabled in a Multi-Action,
     * you would see the value 1. 0 and 1 are valid.
     */
    onKeyDown: function (context, settings, coordinates, userDesiredState) {
        this.setState(context, 0).then();
    },

    /**
     * Method describe key up logic
     * @param context action context;
     * @param settings action settings;
     * @param coordinates event coordinates;
     * @param userDesiredState Only set when the action is triggered with a specific value from a Multi-Action.
     * For example, if the user sets the Game Capture Record action to be disabled in a Multi-Action,
     * you would see the value 1. 0 and 1 are valid.
     */
    onKeyUp: function (context, settings, coordinates, userDesiredState) {
        this.checkBeforeRequest(context, settings).then(isCorrect => {
            if (isCorrect) {
                this.fetchWorkflow(context, settings).then();
            }
        });
    },

    /**
     * Method describe logic, when application appear to screen;
     * @param context action context;
     * @param settings action settings;
     * @param coordinates event coordinates;
     */
    onWillAppear: async function (context, settings, coordinates) {
        this.setRepoName(context, settings).then(() => {
            periodTimer = setTimeout(() => {
                this.fetchWorkflow(context, settings).then();
            }, 1500);
        });
    },

    /**
     * Method describe logic, when application disappear to screen;
     * @param context action context;
     * @param settings action settings;
     * @param coordinates event coordinates;
     */
    onWillDisappear: function (context, settings, coordinates) {
        clearInterval(periodTimer);
        clearInterval(periodInterval);
        timerFlag = false;
        xhr.abort();
    },

    /**
     * Method describe logic to check and set repo name to application title
     * @param context action context;
     * @param settings action settings;
     * @return {Promise<void>} Promise
     */
    setRepoName: async function (context, settings) {
        if (settings.hasOwnProperty('githubRepo') && settings['githubRepo'] !== '') {
            this.setTitle(context, settings['githubRepo']).then();
        }
    },

    /**
     * Method describe logic to set application title
     * @param context action context;
     * @param title new title to set;
     * @return {Promise<void>} Promise
     */
    setTitle: async function (context, title) {
        let json = {
            'event':   'setTitle',
            'context': context,
            'payload': {
                'title':  title,
                'target': DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        };

        websocket.send(JSON.stringify(json));
    },

    /**
     * Method describe logic send setting to memory
     * @param context action context;
     * @param settings action settings;
     */
    setSettings: function (context, settings) {
        let json = {
            'event':   'setSettings',
            'context': context,
            'payload': settings
        };

        websocket.send(JSON.stringify(json));
    },

    /**
     * Method describe logic set action state
     * @param context action context;
     * @param state action state, depend from manifest file. see actions;
     */
    setState: async function (context, state) {
        let json = {
            'event':   'setState',
            'context': context,
            'payload': {
                'state': state
            }
        };

        websocket.send(JSON.stringify(json));
    },

    /**
     * Method describe logic to send to parameter inspector last received error/no error message
     * @param context action context;
     * @param settings action settings;
     * @param text text to send;
     */
    setLastError: function (context, settings, text) {
        settings.lastErrorMessage = text;

        this.setSettings(context, settings);
    },

    /**
     * Method describe logic to check, which setting are not defined
     * @param context action context;
     * @param settings action settings;
     * @param checkAllParams check all settings or without workflow id;
     * @return {Promise<boolean>} Promise;
     */
    checkBeforeRequest: async function (context, settings, checkAllParams) {
        if (settings != null) {
            let condition = checkAllParams ?
                            settings.hasOwnProperty('githubUsername') && settings['githubUsername'] === '' ||
                                settings.hasOwnProperty('githubRepo') && settings['githubRepo'] === '' ||
                                settings.hasOwnProperty('githubWorkflow') && settings['githubWorkflow'] === '' ||
                                githubToken === '' :
                            settings.hasOwnProperty('githubUsername') && settings['githubUsername'] === '' ||
                                settings.hasOwnProperty('githubRepo') && settings['githubRepo'] === '' ||
                                githubToken === '';

            if (condition) {
                const checkText = `Check settings!<br/>` +
                    `githubUsername: ${settings['githubUsername']}<br/>` +
                    `githubRepo: ${settings['githubRepo']}<br/>` +
                    `githubWorkflow: ${settings['githubWorkflow']}<br/>` +
                    `githubToken: ${githubToken}<br/>`;

                this.setState(context, 2).then(() => this.setLastError(context, settings, checkText));

                return false;
            } else {
                return true;
            }
        } else {
            return false;
        }
    },

    /**
     * Method describe logic to fetch workflows id's from GitHub API
     * @param context action context;
     * @param settings action settings;
     */
    fetchWorkflows: function (context, settings) {
        let self = this;

        self.checkBeforeRequest(context, settings, false).then((isCorrect) => {
            if (isCorrect) {
                const url = `${GITHUB_API_URL}/${settings['githubUsername']}/${settings['githubRepo']}/${GITHUB_WORKFLOWS_PATH}`;

                self.setState(context, 1).then(() =>
                    this.sendRequest(context, settings, url, (xhr) => {
                        self.setState(context, 5).then(() => {
                            let res = JSON.parse(xhr.response);

                            settings.lastErrorMessage = 'No errors.';
                            settings.workflowsIDs = res.workflows;

                            self.setSettings(context, settings);
                        });
                    }));
            }
        });
    },

    /**
     * Method describe logic to fetch workflows runs from GitHub API
     * @param context action context;
     * @param settings action settings;
     */
    fetchWorkflow: async function (context, settings) {
        let self = this;

        self.checkBeforeRequest(context, settings, true).then((isCorrect) => {
            if (isCorrect) {
                const url = `${GITHUB_API_URL}/${settings['githubUsername']}/${settings['githubRepo']}/${GITHUB_WORKFLOWS_PATH}/${settings['githubWorkflow']}/runs`;

                self.setState(context, 1).then(() => {
                    this.sendRequest(context, settings, url, (xhr) => {

                        let responseJson = JSON.parse(xhr.response);
                        let runs = responseJson['workflow_runs'];

                        if (responseJson['total_count'] > 0) {
                            if (runs[0].status === Status.COMPLETED) {

                                self.setState(context, 3).then();
                                clearInterval(periodInterval);
                                timerFlag = false;

                            } else if (runs[0].status === Status.CANCELLED ||
                                runs[0].status === Status.ACTION_REQUIRED ||
                                runs[0].status === Status.FAILURE ||
                                runs[0].status === Status.NEUTRAL) {

                                self.setState(context, 6).then();
                                clearInterval(periodInterval);
                                timerFlag = false;

                            } else if (runs[0].status === Status.IN_PROGRESS ||
                                runs[0].status === Status.QUEUED ||
                                runs[0].status === Status.REQUESTED ||
                                runs[0].status === Status.WAITING) {

                                self.setState(context, 7).then();

                                if (!timerFlag) {
                                    periodInterval = setInterval(() => self.fetchWorkflow(context, settings), 15000);
                                    timerFlag = true;
                                }
                            }

                            self.setLastError(context, settings, runs[0].status);
                        } else {
                            self.setState(context, 4).then(() => {
                                self.setLastError(context, settings,
                                    `No runs for this workflow id [${settings['githubWorkflow']}]`);
                            });
                            clearInterval(timerFlag);
                            timerFlag = false;
                        }
                    });
                });
            }
        });
    },

    /**
     * Method describe logic to send XHR Request to GitHub API
     * @param context action context;
     * @param settings action settings;
     * @param url url;
     * @param callback callback function;
     */
    sendRequest: function (context, settings, url, callback) {
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Content-Type', `application/vnd.github+json`);
        xhr.setRequestHeader('Authorization', `Bearer ${githubToken}`);
        xhr.send();

        let self = this;

        xhr.onload = function () {
            if (xhr.status === 200) {
                callback(xhr);
            } else {
                self.setState(context, 4).then(() => {
                    self.setRepoName(context, settings).then(() =>
                        self.setLastError(context, settings, xhr.response));
                });
            }
        };

        xhr.onerror = function () { // происходит, только когда запрос совсем не получилось выполнить
            console.error(`Ошибка соединения`);

            self.setState(context, 2).then();
        };

        xhr.onprogress = function () {
            // запускается периодически
            // event.loaded - количество загруженных байт
            // event.lengthComputable = равно true, если сервер присылает заголовок Content-Length
            // event.total - количество байт всего (только если lengthComputable равно true)
        };
    }
};

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;

    // Open the web socket
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    function registerPlugin(_inPluginUUID) {
        let json = {
            'event': inRegisterEvent,
            'uuid':  _inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    }

    function requestGlobalSettings(inUUID) {
        const json = {
            'event':   'getGlobalSettings',
            'context': inUUID
        };
        websocket.send(JSON.stringify(json));
    }

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
        requestGlobalSettings(pluginUUID);
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        // console.debug(evt.data);

        let jsonObj = JSON.parse(evt.data);
        let event = jsonObj['event'];
        let action = jsonObj['action'];

        let context = jsonObj['context'];

        if (event === 'sendToPlugin') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            if (jsonPayload.hasOwnProperty('piAction') && jsonPayload['piAction'] === 'sendToPlugin') {
                console.log(`[sendToPlugin]: ${jsonPayload.piAction}`);
                githubCIAction.fetchWorkflows(context, settings);
            }
        } else if (event === 'keyDown') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            githubCIAction.onKeyDown(context, settings, coordinates, userDesiredState);
        } else if (event === 'keyUp') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            let userDesiredState = jsonPayload['userDesiredState'];
            githubCIAction.onKeyUp(context, settings, coordinates, userDesiredState);
        } else if (event === 'willAppear') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            githubCIAction.onWillAppear(context, settings, coordinates).then();
        } else if (event === 'willDisappear') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            let coordinates = jsonPayload['coordinates'];
            githubCIAction.onWillDisappear(context, settings, coordinates);
        } else if (event === 'didReceiveGlobalSettings') {
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            if (settings != null && settings.hasOwnProperty('githubToken')) {
                githubToken = settings['githubToken'];
            }
        } else if (event === 'didReceiveSettings') {
            console.debug('didReceiveSettings: checkSettings:');
            let jsonPayload = jsonObj['payload'];
            let settings = jsonPayload['settings'];
            githubCIAction.setRepoName(context, settings).then();
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };
}
