import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar: { [index: string]: { title?: string, day?: string, time?: string, yes?: string, no?: string, username?: string, meet?: string, name?: string, whom?: string, celebname?: string, user?: string, abstract?: string } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "On Monday.": { day: "Monday" },
    "At 10": { time: "10:00" },
    "Yes.": { yes: "Yes" },
    "Of course.": { yes: "ofcourse" },
    "No way.": { no: "no way" },
    "No.": { no: "No" },
    "Create a meeting.": { meet: "creating a meeting" },
    "Search": { whom: "know about a person" },
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    id: 'main',
    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'greeting',
                CLICK: 'greeting'
            }
        },

        greeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.user',
                        actions: assign({ username: (context) => context.recResult[0].utterance })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                ENDSPEECH: { target: 'what_to_do' }
            },
            states: {
                prompt: {
                    entry: say('Hey,what is your name?'),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN')
                },
                nomatch: {
                    entry: say("Sorry, I don't know you.")
                },
                user: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Hi, ${context.username}`
                    })),
                }
            }
        },

        what_to_do: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'welcome',//create a meeting
                        cond: (context) => 'meet' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ meet: (context) => grammar[context.recResult[0].utterance].meet! })
                    },
                    {
                        target: 'meet_whom',//know about a person
                        cond: (context) => 'whom' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ whom: (context) => grammar[context.recResult[0].utterance].whom! })
                    },
                    {
                        target: '.nomatch',
                    }
                ],

            },
            states: {
                prompt: {
                    entry: say('Do you want me to search or create a meeting?'),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN')
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },

        meet_whom: {
            initial: 'prompt',
            on: {
                RECOGNISED: {
                    target: 'search',
                    actions: assign({ celebname: (context) => context.recResult[0].utterance }),
                },
            },

            states: {
                prompt: {
                    entry: say('Whom do you want to know about?'),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN')
                },
            }
        },

        search: {
            invoke: {
                src: (context) => kbRequest(context.celebname),
                onDone: {
                    target: '#main.about_person',
                    actions: assign({ abstract: (context, event) => event.data.Abstract }),
                },
                onError: {
                    target: 'anotherperson',
                },

            },
        },

        about_person: {
            initial: 'prompt',
            on: {
                RECOGNISED: {},
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `${context.abstract}`
                    })),
                    on: {
                        ENDSPEECH: { target: '#main.meet_celeb' },
                    },
                },
            }
        },
        anotherperson: {
            initial: 'prompt',
            states: {
                prompt: {
                    entry: say("Try another person!"),
                    on: {
                        ENDSPEECH: { target: '#main.meet_whom' }
                    }
                }
            }
        },
        meet_celeb: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.meet_celeb',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ title: (context) => `meeting with ${context.celebname}` })
                    },
                    {
                        target: '#main.meet_whom',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ no: (context) => grammar[context.recResult[0].utterance].no! })
                    }
                ]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Do you want to meet ${context.celebname}`
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN')
                },
                meet_celeb: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Ok, meeting with ${context.celebname}`
                    })),
                    on: { ENDSPEECH: '#main.date' }
                }
            },
        },
        welcome: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.info',
                        cond: (context) => 'title' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt',
                ENDSPEECH: { target: 'date' }
            },
            states: {
                prompt: {
                    entry: say("Let's create a meeting. What is it about?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                info: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, ${context.title}`
                    })),
                }
            }
        },

        date: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.dayinfo',
                        cond: (context) => 'day' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt',
                ENDSPEECH: { target: 'confirm' }
            },
            states: {
                prompt: {
                    entry: say("On which day is it?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is."),
                    on: { ENDSPEECH: 'ask' }
                },
                dayinfo: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `OK, ${context.day}`
                    })),
                }
            }
        },

        confirm: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'whole_day_meeting',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! })
                    },
                    {
                        target: 'meeting_time',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ no: (context) => grammar[context.recResult[0].utterance].no! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt',
                // ENDSPEECH: { target: 'whole_day' }
            },
            states: {
                prompt: {
                    entry: say("Will it take the whole day?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, Can you please repeat?"),
                    on: { ENDSPEECH: 'ask' }
                },

                noinfo: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `okay`
                    }))
                }
            }
        },

        whole_day_meeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meeting_created',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! })
                    },
                    {
                        target: 'welcome',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ no: (context) => grammar[context.recResult[0].utterance].no! })
                    },
                    {
                        target: '.nomatch'
                    }
                ]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Do you want me to create a meeting titled ${context.title} on ${context.day} for the whole day?`
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, Can you please repeat?"),
                    on: { ENDSPEECH: 'ask' }
                },
            }
        },
        meeting_created: {
            entry: send((context) => ({
                type: 'SPEAK',
                value: `Your meeting has been created.`
            })),
        },
        meeting_time: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'timed_meeting',
                        cond: (context) => 'time' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ time: (context) => grammar[context.recResult[0].utterance].time! })
                    },
                ]
            },
            states: {
                prompt: {
                    entry: say('what time is your meeting?'),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't have that time."),
                    on: { ENDSPEECH: 'ask' }
                },
            }
        },
        timed_meeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meeting_created',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! })
                    },
                    {
                        target: 'welcome',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance]),
                        actions: assign({ no: (context) => grammar[context.recResult[0].utterance].no! })
                    },
                    {
                        target: '.nomatch'
                    }
                ]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}?`
                    })),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is."),
                    on: { ENDSPEECH: 'ask' }
                },
            }
        }
    }
})

const kbRequest = (text: string) =>
    fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())
