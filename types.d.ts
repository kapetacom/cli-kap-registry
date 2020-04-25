

interface PushCommandOptions {
    registry:string
    ignoreWorkingDirectory:boolean
    skipTests:boolean
    autoVersioning:boolean
    checkVersion:boolean
    reserveTtl:number
    dryRun:boolean
    verbose:boolean
}

interface VersionReservation {
    block:any
    options: {[key:string]:any}
}

interface VCSHandler {
    getName():string
    getType():string
    isRepo(dirname:string):Promise<boolean>
    add(directory:string, filename:string):Promise<void>
    commit(directory:string, message:string):Promise<string>
    push(directory:string, includeTags:boolean):Promise<void>
    tag(directory:string, tag:string):Promise<boolean>
    getLatestCommit(directory:string):Promise<string>
    getBranch(directory:string):Promise<string>
    getRemote(directory:string):Promise<string>
    getCheckoutInfo(directory:string):Promise<any>
    isWorkingDirectoryClean(directory:string):Promise<boolean>;
    isWorkingDirectoryUpToDate(directory:string):Promise<boolean>;
}

interface Reservation {
    block: BlockDefinition
    properties: {[key:string]:any}
}

interface BlockRegistration {
    block: BlockDefinition
    properties: {[key:string]:any}
}

interface BlockDefinition {
    kind: string
    metadata: BlockMetaData,
    spec: BlockDefinitionSpec
}

interface BlockDefinitionSpec {
    entities: BlockEntityDefinition[]
    consumers: BlockResourceDefinition[]
    providers: BlockResourceDefinition[]
}

type APIResourceType  = string|{$ref:string}

interface BlockEntityPropertyDefinition {
    type:string
}


interface BlockEntityDefinition {
    name:string
    properties: {[id:string]:BlockEntityPropertyDefinition}
}

interface BlockResourceDefinition {
    kind: string
    metadata: {
        name: string
    },
    spec: any
}



interface APIResourceMethodArgument {
    type: APIResourceType
    transport: string
    id: string
}

interface APIResourceMethod {
    description: string
    method: string
    path: string
    arguments: {[id:string]:APIResourceMethodArgument}
    responseType: APIResourceType
}

type APIResourceMethodMap = {[id:string]:APIResourceMethod}

interface BlockMetaData {
    name: string
    version: string
}

interface ReserveOptions {
    /**
     * Disables automatic semantic versioning
     */
    disableAutoVersion: boolean

    /**
     * Disables checks for proper semantic versioning
     */
    skipVersionCheck: boolean

    /**
     * This tells the system how long to keep the reservation for until automatically aborting it
     */
    ttl: number
}

interface CommitOptions {

}

interface AbortOptions {

}

interface VersionInfo {
    patch: number
    major: number
    minor: number
    compare:(other:VersionInfo) => number
    toString:() => string
}

enum VersionDiffType {
    MAJOR = 'MAJOR',
    MINOR = 'MINOR',
    PATCH = 'PATCH',
    NONE = 'NONE'
}

type BlockRegistrationMap = {[blockId:string]:{[versionId:string]:BlockRegistration}};

type BlockReservationMap = {[blockId:string]:Reservation};

type PromiseCallback = ()=>Promise<any>;
type PromiseOrCallback = Promise<any>|PromiseCallback;

type DataHandler = (data:any) => void;