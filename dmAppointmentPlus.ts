import { count } from "console";
import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { MachineConfig, send, Action, assign } from "xstate";

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar: { [index: string]: { title?: string, day?: string, time?: string, yes?: string, no?: string, username?: string, meet?: string, name?: string, whom?: string, celebname?: string, user?: string, abstract?: string, help?: string,count?: number,threshold?: number } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "On Monday.": { day: "Monday" },
    "At 10": { time: "10:00" },
    "Yes.": { yes: "Yes" },
    "Yeah.": { yes: "Yeah"},
    "Of course.": { yes: "ofcourse" },
    "No way.": { no: "no way" },
    "No.": { no: "No" },
    "Create a meeting.": { meet: "creating a meeting" },
    "Search": { whom: "search about a person" },
    "Help.": {help: "help"},
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    entry: assign({count : (context) => 0}),
    id: 'main',
    states: {
        idle: {
            on: {
                CLICK: 'init',
            }
        },
        init: {
            on: {
                TTS_READY: 'greeting',
                CLICK: 'greeting',
            }
        },
        
        greeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        //if the user intent confidence is > threshold confidence
                        target: '.user',
                        cond: (context) => context.recResult[0].confidence > 0.8,
                        actions: [assign({ username: (context) => context.recResult[0].utterance,}), 
                                  assign({count: (context) => 0}) ]      
                    },
                    {
                        //if not
                        target:'.greeting_confirmation',
                        cond: (context) => context.recResult[0].confidence < 0.8,
                        actions: assign({ username: (context) => context.recResult[0].utterance})
                    },

                ],
                ENDSPEECH: { target: 'what_to_do' },
                TIMEOUT:[
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
            },

            states: {
                prompt: {
                    entry:say('What is your name?'),
                    on: { ENDSPEECH: 'ask' },                    
                },
                ask: {
                    entry: send('LISTEN'),
                },
                
                user: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Hi, ${context.username}`
                    })),
                },
                greeting_confirmation:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.greeting.user',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.greeting.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.username}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    }
                },
            }
        },

        what_to_do: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'welcome',//create a meeting
                        cond: (context) => 'meet' in (grammar[context.recResult[0].utterance] || {} )&& context.recResult[0].confidence > 0.8,
                        actions: [assign({ meet: (context) => grammar[context.recResult[0].utterance].meet! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.confirm_welcome',//create a meeting
                        cond: (context) => 'meet' in (grammar[context.recResult[0].utterance] || {} )&& context.recResult[0].confidence < 0.8,
                        actions: [assign({ meet: (context) => grammar[context.recResult[0].utterance].meet! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: 'meet_whom',//know about a person
                        cond: (context) => 'whom' in (grammar[context.recResult[0].utterance] || {} )&& context.recResult[0].confidence > 0.8,
                        actions: [assign({ whom: (context) => grammar[context.recResult[0].utterance].whom! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.confirm_meet_whom',//know about a person
                        cond: (context) => 'whom' in (grammar[context.recResult[0].utterance] || {} )&& context.recResult[0].confidence < 0.8,
                        actions: [assign({ whom: (context) => grammar[context.recResult[0].utterance].whom! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT:[
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
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
                    on: { ENDSPEECH: 'prompt' }
                },
                confirm_welcome:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.welcome',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.what_to_do.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.meet}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                },
                confirm_meet_whom:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.meet_whom',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.what_to_do.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.whom}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                },
            }
        },

        meet_whom: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                {
                    target: 'search',
                    cond: (context) => context.recResult[0].confidence > 0.8,
                    actions: [assign({ celebname: (context) => context.recResult[0].utterance }),
                              assign({count: (context) => 0})]
                },
                {
                    target: '.confirm_search',
                    cond: (context) => context.recResult[0].confidence < 0.8,
                    actions: [assign({ celebname: (context) => context.recResult[0].utterance }),
                              assign({count: (context) => 0})]
                },
                {
                    target: '.help',
                    cond: (context) => 'help' in (grammar[context.recResult[0].utterance] ||{}),
                    actions: [assign({ help: (context) => grammar[context.recResult[0].utterance].help! }),
                              assign({count: (context) => 0}) ]
                }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
            },
            states: {
                prompt: {
                    entry: say('Whom do you want to know about?'),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN')
                },
                help: {
                    entry: say('Try saying Micheal Jackson or Joe Biden')
                },
                confirm_search:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.search',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.meet_whom.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.celebname}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                }
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
                        ENDSPEECH: { target: '#main.meet_whom' },
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
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ title: (context) => `meeting with ${context.celebname}` }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '#main.meet_whom',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ no: (context) => grammar[context.recResult[0].utterance].no! }),
                                  assign({count: (context) => 0})]
                    }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Do you want to meet ${context.celebname}`
                    })),
                    on: { 
                        ENDSPEECH: 'ask',
                    }
                },
                ask: {
                    entry: send('LISTEN')
                },
                meet_celeb: {
                    entry: send((context) => ({
                        type: 'SPEAK',
                        value: `Ok, meeting with ${context.celebname}`
                    })),
                    on: { 
                        ENDSPEECH: '#main.date',
                }
                    
                }
            },
        },
        welcome: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.info',
                        cond: (context) => 'title' in (grammar[context.recResult[0].utterance] ||{}) &&  context.recResult[0].confidence >= 0.8,
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                    },
                    {
                        target: '.confirm_info',
                        cond: (context) => 'title' in (grammar[context.recResult[0].utterance] ||{}) &&  context.recResult[0].confidence < 0.8,
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                    },
                    {
                        target: '.help',
                        cond: (context) => 'help' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: assign({ help: (context) => grammar[context.recResult[0].utterance].help! })
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
                help: {
                    entry: say("You can try saying 'lunch' or 'lecture'."),
                    on: {ENDSPEECH: 'prompt'}
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
                },
                confirm_info:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.welcome.info',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.welcome.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.title}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                }
            }
        },

        date: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: '.dayinfo',
                        cond: (context) => 'day' in (grammar[context.recResult[0].utterance] ||{}) && context.recResult[0].confidence >=0.8,
                        actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })
                    },
                    {
                        target: '.confirm_dayinfo',
                        cond: (context) => 'day' in (grammar[context.recResult[0].utterance] ||{}) && context.recResult[0].confidence <0.8,
                        actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })
                    },
                    {
                        target: '.help',
                        cond: (context) => 'help' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: assign({ help: (context) => grammar[context.recResult[0].utterance].help! }) 
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
                help: {
                    entry: say("Try saying Monday or Tuesday or any weekday."),
                    on: {ENDSPEECH: 'prompt'}
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
                },
                confirm_dayinfo:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.date.dayinfo',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.date.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.day}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                }
            }
        },

        confirm: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'whole_day_meeting',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: 'meeting_time',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ no: (context) => grammar[context.recResult[0].utterance].no! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
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
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: 'welcome',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ no: (context) => grammar[context.recResult[0].utterance].no! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
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
                        cond: (context) => 'time' in (grammar[context.recResult[0].utterance] ||{}) && context.recResult[0].confidence >=0.8,
                        actions: [assign({ time: (context) => grammar[context.recResult[0].utterance].time! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.confirm_timed_meeting',
                        cond: (context) => 'time' in (grammar[context.recResult[0].utterance] ||{}) && context.recResult[0].confidence <0.8,
                        actions: [assign({ time: (context) => grammar[context.recResult[0].utterance].time! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.help',
                        cond: (context) => 'help' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ help: (context) => grammar[context.recResult[0].utterance].help! }) ,
                                  assign({count: (context) => 0})]
                    }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
            },
            states: {
                prompt: {
                    entry: say('what time is your meeting?'),
                    on: { ENDSPEECH: 'ask' }
                },
                help: {
                    entry: say("Try saying at 10."),
                    on: { ENDSPEECH: 'prompt' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't have that time."),
                    on: { ENDSPEECH: 'ask' }
                },
                confirm_timed_meeting:{
                    initial:'prompt',
                    on:{
                        RECOGNISED:[
                            {
                                target:'#root.dm.timed_meeting',
                                cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({count: (context) => 0})
                            },
                            {
                                target:'#root.dm.meeting_time.prompt',
                                cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                                actions: assign({ username: (context) => context.recResult[0].utterance}),      
                            },
                        ]
                    },
                    states:{
                        prompt:{
                            entry: send((context) => ({
                            type: 'SPEAK',
                            value: `Did you mean ${context.time}`
                        })),
                            on:{ENDSPEECH:'ask'}
                        },
                        ask:{
                            entry: send('LISTEN')
                        },
                    },
                }
            }
        },
        timed_meeting: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meeting_created',
                        cond: (context) => 'yes' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ yes: (context) => grammar[context.recResult[0].utterance].yes! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: 'welcome',
                        cond: (context) => 'no' in (grammar[context.recResult[0].utterance] ||{}),
                        actions: [assign({ no: (context) => grammar[context.recResult[0].utterance].no! }),
                                  assign({count: (context) => 0})]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [
                    {
                        target:'.prompt',
                        cond: (context) => context.count < 2,
                        actions:assign({count: (context) => context.count + 1})
                    },
                    {
                        target: '#root.dm.init',
                    },
                ],
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
