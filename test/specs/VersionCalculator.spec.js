
const VersionCalculator = require('../../src/utils/VersionCalculator');

describe('VersionCalculator', () => {

    it('can parse well formed version', () => {
        const version = VersionCalculator.parseVersion('12.34.56');
        expect(version.major).toBe(12);
        expect(version.minor).toBe(34);
        expect(version.patch).toBe(56);
    });

    it('can convert version segment to number', () => {
        expect(VersionCalculator.typeToNumber(VersionCalculator.MAJOR)).toBe(3);
        expect(VersionCalculator.typeToNumber(VersionCalculator.MINOR)).toBe(2);
        expect(VersionCalculator.typeToNumber(VersionCalculator.PATCH)).toBe(1);
        expect(VersionCalculator.typeToNumber(VersionCalculator.NONE)).toBe(0);
    });

    it('can increment version given version segment', () => {
        const version = '1.0.0';
        expect(VersionCalculator.incrementVersionBy(version, VersionCalculator.MAJOR)).toBe('2.0.0');
        expect(VersionCalculator.incrementVersionBy(version, VersionCalculator.MINOR)).toBe('1.1.0');
        expect(VersionCalculator.incrementVersionBy(version, VersionCalculator.PATCH)).toBe('1.0.1');
        expect(VersionCalculator.incrementVersionBy(version, VersionCalculator.NONE)).toBe('1.0.1');
    });

    it('can calculate increment type between 2 versions', () => {
        const version = '1.0.0';
        expect(VersionCalculator.calculateIncrementType(version,'2.3.4')).toBe(VersionCalculator.MAJOR);
        expect(VersionCalculator.calculateIncrementType(version,'1.3.4')).toBe(VersionCalculator.MINOR);
        expect(VersionCalculator.calculateIncrementType(version,'1.0.4')).toBe(VersionCalculator.PATCH);
        expect(VersionCalculator.calculateIncrementType(version, version)).toBe(VersionCalculator.NONE);
    });

    it('can compare increment types', () => {

        /* -- MAJOR -- */
        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MAJOR,VersionCalculator.MAJOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MAJOR,VersionCalculator.MINOR))
            .toBe(true);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MAJOR,VersionCalculator.PATCH))
            .toBe(true);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MAJOR,VersionCalculator.NONE))
            .toBe(true);

        /* -- MINOR -- */

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MINOR,VersionCalculator.MAJOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MINOR,VersionCalculator.MINOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MINOR,VersionCalculator.PATCH))
            .toBe(true);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.MINOR,VersionCalculator.NONE))
            .toBe(true);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.PATCH,VersionCalculator.MAJOR))
            .toBe(false);

        /* -- PATCH -- */

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.PATCH,VersionCalculator.MINOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.PATCH,VersionCalculator.PATCH))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.PATCH,VersionCalculator.NONE))
            .toBe(true);

        /* -- NONE -- */

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.NONE,VersionCalculator.MAJOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.NONE,VersionCalculator.MINOR))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.NONE,VersionCalculator.PATCH))
            .toBe(false);

        expect(VersionCalculator
            .isIncrementGreaterThan(VersionCalculator.NONE,VersionCalculator.NONE))
            .toBe(false);

    });

    describe('when calculating version increment', () => {
        const BLOCK_KIND = 'kind.block';
        const BLOCK_KIND2 = 'kind.block2';

        let calculator;
        beforeEach(() => {
            calculator = new VersionCalculator();
        });

        it('can compare entities', () => {

            expect(calculator.compareEntities([],[])).toBe(VersionCalculator.NONE);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ],
                []
            )).toBe(VersionCalculator.MINOR);

            expect(calculator.compareEntities(
                [
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}, password:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}},
                    {name:'Task', properties:{name:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(VersionCalculator.MINOR);

        });

        it('can compare API methods', () => {
            expect(calculator.compareMethods(
                {},
                {}
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {

                }
            )).toBe(VersionCalculator.MINOR);

            expect(calculator.compareMethods(
                {

                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'number'} }}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }},
                    saveUser: {path:'/user/{id}', method: 'POST', arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(VersionCalculator.MINOR);

        });

        it('can compare resources', () => {
            expect(calculator.compareResources(
                {},
                {}
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}},
                {kind:'db',metadata:{name:'my-db'}}
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                {kind:'db',metadata:{name:'my-db'}}
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {other:true}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(VersionCalculator.MAJOR);
        });

        it('can compare resource maps', () => {
            expect(calculator.compareResourceMaps(
                {},
                {}
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(VersionCalculator.NONE);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                }
            )).toBe(VersionCalculator.MINOR);

            expect(calculator.compareResourceMaps(
                {
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'other-db'}, spec: {something:true}}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                    'db:other-db':{kind:'db',metadata:{name:'other-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(VersionCalculator.MINOR);
        });

        it('can compare block definitions', async () => {


            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND
                },
                {
                    kind: BLOCK_KIND
                }
            )).toBe(VersionCalculator.NONE);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND
                },
                {
                    kind: BLOCK_KIND2
                }
            )).toBe(VersionCalculator.MAJOR);
        });

        it('will return change if entities need it', async () => {
            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[{name:'User'}]}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[{name:'User'}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[]}
                }
            )).toBe(VersionCalculator.MINOR);
        });

        it('will return change if provider resources need it', async () => {
            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[{metadata:{name:'User'}}]}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[{metadata:{name:'User'}}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[]}
                }
            )).toBe(VersionCalculator.MINOR);
        });

        it('will return change if consumer resources need it', async () => {
            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[{metadata:{name:'User'}}]}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[{metadata:{name:'User'}}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[]}
                }
            )).toBe(VersionCalculator.MINOR);
        });

        it('will return highest degree of change needed', async () => {
            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.NONE);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.MINOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[

                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[

                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}},
                            {kind: 'db',metadata:{name:'Tasks'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.MINOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}},
                            {kind: 'db',metadata:{name:'Tasks'}}
                        ],
                        entities:[

                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe(VersionCalculator.MAJOR);

        });

        it('can calculate next version',  async () => {
            const metadata = {
                name: 'MyBlock',
                version: '1.0.0'
            };

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('1.0.1');

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('1.1.0');

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[

                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('2.0.0');

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[

                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'},
                            {name:'Task'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('2.0.0');

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}},
                            {kind: 'db',metadata:{name:'Tasks'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('1.1.0');

            expect(await calculator.calculateNextVersion(
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}},
                            {kind: 'db',metadata:{name:'Tasks'}}
                        ],
                        entities:[

                        ]}
                },
                {
                    kind: BLOCK_KIND,
                    metadata,
                    spec: {
                        consumers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        providers:[
                            {kind: 'db',metadata:{name:'User'}}
                        ],
                        entities:[
                            {name:'User'}
                        ]}
                }
            )).toBe('2.0.0');
        });

    });
});
