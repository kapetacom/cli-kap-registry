
const BlockVersionCalculator = require('../../src/utils/BlockVersionCalculator');

describe('BlockVersionCalculator', () => {

    it('can parse well formed version', () => {
        const version = BlockVersionCalculator.parseVersion('12.34.56');
        expect(version.major).toBe(12);
        expect(version.minor).toBe(34);
        expect(version.patch).toBe(56);
    });

    it('can convert version segment to number', () => {
        expect(BlockVersionCalculator.typeToNumber(BlockVersionCalculator.MAJOR)).toBe(3);
        expect(BlockVersionCalculator.typeToNumber(BlockVersionCalculator.MINOR)).toBe(2);
        expect(BlockVersionCalculator.typeToNumber(BlockVersionCalculator.PATCH)).toBe(1);
        expect(BlockVersionCalculator.typeToNumber(BlockVersionCalculator.NONE)).toBe(0);
    });

    it('can increment version given version segment', () => {
        const version = '1.0.0';
        expect(BlockVersionCalculator.incrementVersionBy(version, BlockVersionCalculator.MAJOR)).toBe('2.0.0');
        expect(BlockVersionCalculator.incrementVersionBy(version, BlockVersionCalculator.MINOR)).toBe('1.1.0');
        expect(BlockVersionCalculator.incrementVersionBy(version, BlockVersionCalculator.PATCH)).toBe('1.0.1');
        expect(BlockVersionCalculator.incrementVersionBy(version, BlockVersionCalculator.NONE)).toBe('1.0.0');
    });

    it('can calculate increment type between 2 versions', () => {
        const version = '1.0.0';
        expect(BlockVersionCalculator.calculateIncrementType(version,'2.3.4')).toBe(BlockVersionCalculator.MAJOR);
        expect(BlockVersionCalculator.calculateIncrementType(version,'1.3.4')).toBe(BlockVersionCalculator.MINOR);
        expect(BlockVersionCalculator.calculateIncrementType(version,'1.0.4')).toBe(BlockVersionCalculator.PATCH);
        expect(BlockVersionCalculator.calculateIncrementType(version, version)).toBe(BlockVersionCalculator.NONE);
    });

    it('can compare increment types', () => {

        /* -- MAJOR -- */
        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MAJOR,BlockVersionCalculator.MAJOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MAJOR,BlockVersionCalculator.MINOR))
            .toBe(true);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MAJOR,BlockVersionCalculator.PATCH))
            .toBe(true);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MAJOR,BlockVersionCalculator.NONE))
            .toBe(true);

        /* -- MINOR -- */

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MINOR,BlockVersionCalculator.MAJOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MINOR,BlockVersionCalculator.MINOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MINOR,BlockVersionCalculator.PATCH))
            .toBe(true);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.MINOR,BlockVersionCalculator.NONE))
            .toBe(true);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.PATCH,BlockVersionCalculator.MAJOR))
            .toBe(false);

        /* -- PATCH -- */

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.PATCH,BlockVersionCalculator.MINOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.PATCH,BlockVersionCalculator.PATCH))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.PATCH,BlockVersionCalculator.NONE))
            .toBe(true);

        /* -- NONE -- */

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.NONE,BlockVersionCalculator.MAJOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.NONE,BlockVersionCalculator.MINOR))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.NONE,BlockVersionCalculator.PATCH))
            .toBe(false);

        expect(BlockVersionCalculator
            .isIncrementGreaterThan(BlockVersionCalculator.NONE,BlockVersionCalculator.NONE))
            .toBe(false);

    });

    describe('when calculating version increment', () => {
        const BLOCK_KIND = 'kind.block';
        const BLOCK_KIND2 = 'kind.block2';

        let calculator;
        beforeEach(() => {
            calculator = new BlockVersionCalculator();
        });

        it('can compare entities', () => {

            expect(calculator.compareEntities([],[])).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ],
                []
            )).toBe(BlockVersionCalculator.MINOR);

            expect(calculator.compareEntities(
                [
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}, password:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareEntities(
                [
                    {name:'User', properties:{email:{type:'string'}}},
                    {name:'Task', properties:{name:{type:'string'}}}
                ],
                [
                    {name:'User', properties:{email:{type:'string'}}}
                ]
            )).toBe(BlockVersionCalculator.MINOR);

        });

        it('can compare API methods', () => {
            expect(calculator.compareMethods(
                {},
                {}
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {

                }
            )).toBe(BlockVersionCalculator.MINOR);

            expect(calculator.compareMethods(
                {

                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'number'} }}
                }
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareMethods(
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }},
                    saveUser: {path:'/user/{id}', method: 'POST', arguments: {id: {type:'string'} }}
                },
                {
                    getUser: {path:'/user/{id}',arguments: {id: {type:'string'} }}
                }
            )).toBe(BlockVersionCalculator.MINOR);

        });

        it('can compare resources', () => {
            expect(calculator.compareResources(
                {},
                {}
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}},
                {kind:'db',metadata:{name:'my-db'}}
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                {kind:'db',metadata:{name:'my-db'}}
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareResources(
                {kind:'db',metadata:{name:'my-db'}, spec: {other:true}},
                {kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
            )).toBe(BlockVersionCalculator.MAJOR);
        });

        it('can compare resource maps', () => {
            expect(calculator.compareResourceMaps(
                {},
                {}
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(BlockVersionCalculator.NONE);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                }
            )).toBe(BlockVersionCalculator.MINOR);

            expect(calculator.compareResourceMaps(
                {
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'other-db'}, spec: {something:true}}
                }
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(calculator.compareResourceMaps(
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}},
                    'db:other-db':{kind:'db',metadata:{name:'other-db'}, spec: {something:true}}
                },
                {
                    'db:my-db':{kind:'db',metadata:{name:'my-db'}, spec: {something:true}}
                }
            )).toBe(BlockVersionCalculator.MINOR);
        });

        it('can compare block definitions', async () => {


            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND
                },
                {
                    kind: BLOCK_KIND
                }
            )).toBe(BlockVersionCalculator.NONE);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND
                },
                {
                    kind: BLOCK_KIND2
                }
            )).toBe(BlockVersionCalculator.MAJOR);
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
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[{name:'User'}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {entities:[]}
                }
            )).toBe(BlockVersionCalculator.MINOR);
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
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[{metadata:{name:'User'}}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {providers:[]}
                }
            )).toBe(BlockVersionCalculator.MINOR);
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
            )).toBe(BlockVersionCalculator.MAJOR);

            expect(await calculator.compareBlockDefinitions(
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[{metadata:{name:'User'}}]}
                },
                {
                    kind: BLOCK_KIND,
                    spec: {consumers:[]}
                }
            )).toBe(BlockVersionCalculator.MINOR);
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
            )).toBe(BlockVersionCalculator.NONE);

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
            )).toBe(BlockVersionCalculator.MINOR);

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
            )).toBe(BlockVersionCalculator.MAJOR);

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
            )).toBe(BlockVersionCalculator.MAJOR);

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
            )).toBe(BlockVersionCalculator.MINOR);

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
            )).toBe(BlockVersionCalculator.MAJOR);

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
            )).toBe(metadata.version);

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
