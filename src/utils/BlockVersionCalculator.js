const _ = require('lodash');

class BlockVersionCalculator {


    /**
     *
     * @param version
     * @returns {VersionInfo}
     */
    static parseVersion(version) {
        const [major, minor, patch] = version.split(/\./g);

        return {
            major: parseInt(major),
            minor: parseInt(minor),
            patch: parseInt(patch),
            /**
             *
             * @param {VersionInfo} other
             */
            compare(other) {
                if (this.major !== other.major) {
                    return this.major - other.major;
                }

                if (this.minor !== other.minor) {
                    return this.minor - other.minor;
                }

                return this.patch - other.patch;
            },
            toString() {
                return `${this.major}.${this.minor}.${this.patch}`
            }
        };
    }

    /**
     *
     * @param {VersionDiffType} type
     */
    static typeToNumber(type) {
        switch (type) {
            case this.MAJOR:
                return 3;
            case this.MINOR:
                return 2;
            case this.PATCH:
                return 1;
        }

        return 0;
    }

    /**
     * Increment version given the increment type
     * @param {string} version
     * @param {VersionDiffType} incrementType
     */
    static incrementVersionBy(version, incrementType) {
        const versionInfo = BlockVersionCalculator.parseVersion(version);

        switch (incrementType) {
            case BlockVersionCalculator.MAJOR:
                versionInfo.major++;
                return versionInfo.toString();

            case BlockVersionCalculator.MINOR:
                versionInfo.minor++;
                return versionInfo.toString();

            case BlockVersionCalculator.PATCH:
            default:
                versionInfo.patch++;
                return versionInfo.toString();
        }
    }

    /**
     *
     * @param {string} versionA
     * @param {string} versionB
     * @returns {VersionDiffType}
     */
    static calculateIncrementType(versionA, versionB) {
        const fromVersionInfo = BlockVersionCalculator.parseVersion(versionA);
        const toVersionInfo = BlockVersionCalculator.parseVersion(versionB);
        if (fromVersionInfo.major !== toVersionInfo.major) {
            return BlockVersionCalculator.MAJOR;
        }

        if (fromVersionInfo.minor !== toVersionInfo.minor) {
            return BlockVersionCalculator.MINOR;
        }

        if (fromVersionInfo.patch !== toVersionInfo.patch) {
            return BlockVersionCalculator.PATCH;
        }

        return BlockVersionCalculator.NONE;
    }

    /**
     * Determines in typeA is a bigger version bump than typeB
     *
     * @param {VersionDiffType} typeA
     * @param {VersionDiffType} typeB
     * @returns {boolean}
     */
    static isIncrementGreaterThan(typeA, typeB) {
        const a = BlockVersionCalculator.typeToNumber(typeA);
        const b = BlockVersionCalculator.typeToNumber(typeB);

        return a > b;
    }

    /**
     * Calculate next semantic version based on the definitions provided
     * @param {BlockDefinition} newDefinition
     * @param {BlockDefinition} existingDefinition
     * @returns {Promise<String>}
     */
    async calculateNextVersion(newDefinition, existingDefinition) {
        const versionDiffRequired = await this.compareBlockDefinitions(newDefinition, existingDefinition);

        return BlockVersionCalculator.incrementVersionBy(newDefinition.metadata.version, versionDiffRequired);
    }

    /**
     * Compares block definitions and determines the required version increment
     * 
     * @param {BlockDefinition} newDefinition
     * @param {BlockDefinition} existingDefinition
     * @returns {Promise<VersionDiffType>}
     */
    async compareBlockDefinitions(newDefinition, existingDefinition) {
        if (newDefinition.kind.toLowerCase() !== existingDefinition.kind.toLowerCase()) {
            return BlockVersionCalculator.MAJOR;
        }

        if (_.isEmpty(newDefinition.spec) && _.isEmpty(existingDefinition.spec)) {
            return BlockVersionCalculator.NONE;
        }

        if (_.isEmpty(newDefinition.spec) && !_.isEmpty(existingDefinition.spec)) {
            //Spec was removed
            return BlockVersionCalculator.MAJOR;
        }

        if (!newDefinition.spec) {
            newDefinition.spec = {};
        }

        const entityMatchType = this.compareEntities(newDefinition.spec.entities, existingDefinition.spec.entities);
        if (entityMatchType === BlockVersionCalculator.MAJOR) {
            return entityMatchType;
        }

        const newConsumers = BlockVersionCalculator._asResourceMap(newDefinition.spec.consumers);
        const oldConsumers = BlockVersionCalculator._asResourceMap(existingDefinition.spec.consumers);

        const consumerMatchType = this.compareResourceMaps(newConsumers, oldConsumers);

        if (consumerMatchType === BlockVersionCalculator.MAJOR) {
            return consumerMatchType;
        }

        const newProviders = BlockVersionCalculator._asResourceMap(newDefinition.spec.providers);
        const oldProviders = BlockVersionCalculator._asResourceMap(existingDefinition.spec.providers);

        const providerMatchType = this.compareResourceMaps(newProviders, oldProviders);

        if (providerMatchType === BlockVersionCalculator.MAJOR) {
            return BlockVersionCalculator.MAJOR;
        }

        if (entityMatchType === BlockVersionCalculator.MINOR ||
            consumerMatchType === BlockVersionCalculator.MINOR ||
            providerMatchType === BlockVersionCalculator.MINOR) {
            return BlockVersionCalculator.MINOR;
        }

        if (entityMatchType === BlockVersionCalculator.PATCH ||
            consumerMatchType === BlockVersionCalculator.PATCH ||
            providerMatchType === BlockVersionCalculator.PATCH) {
            return BlockVersionCalculator.PATCH;
        }

        return BlockVersionCalculator.NONE;
    }

    /**
     * Compares resource maps and determines the required version increment
     * 
     * @param {{[string]:BlockResourceDefinition}} newResources
     * @param {{[string]:BlockResourceDefinition}} oldResources
     * @returns {VersionDiffType}
     */
    compareResourceMaps(newResources, oldResources) {
        let out = BlockVersionCalculator.NONE;

        if (_.isEqual(newResources, oldResources)) {
            return out;
        }

        const oldKeys = Object.keys(oldResources);

        for(let i = 0; i < oldKeys.length; i++) {
            const oldKey = oldKeys[i];

            if (!newResources[oldKey]) {
                //Resource has been removed - major change
                return BlockVersionCalculator.MAJOR;
            }

            const oldResource = oldResources[oldKey];
            const newResource = newResources[oldKey];

            const resourceDiffType = this.compareResources(newResource, oldResource);

            if (resourceDiffType === BlockVersionCalculator.MAJOR) {
                return resourceDiffType;
            }

            if (resourceDiffType === BlockVersionCalculator.MINOR) {
                out = BlockVersionCalculator.MINOR;
            }
        }

        const newKeys = Object.keys(newResources);

        for(let i = 0; i < newKeys.length; i++) {
            const newKey = newKeys[i];

            if (!oldResources[newKey]) {
                //Resource has been added - minor change
                out = BlockVersionCalculator.MINOR;
            }

        }

        return out;
    }

    /**
     * Compares resource definitions and determines the required version increment
     * 
     * @param {BlockResourceDefinition} newResource
     * @param {BlockResourceDefinition} oldResource
     * @returns {VersionDiffType}
     */
    compareResources(newResource, oldResource) {
        if (_.isEqual(newResource, oldResource)) {
            return BlockVersionCalculator.NONE;
        }

        if (oldResource.metadata.name !== newResource.metadata.name) {
            //Changed the name of existing resource - major change
            return BlockVersionCalculator.MAJOR;
        }

        if (!oldResource.spec &&
            !newResource.spec) {
            return BlockVersionCalculator.NONE;
        }

        if (!_.isEmpty(oldResource.spec) && _.isEmpty(newResource.spec)) {
            //New specs are empty - major change
            return BlockVersionCalculator.MAJOR;
        }

        if (_.isEmpty(oldResource.spec) && !_.isEmpty(newResource.spec)) {
            //Old specs are empty - major change
            return  BlockVersionCalculator.MAJOR;
        }

        const kind = newResource.kind.toLowerCase();

        switch (kind) {
            case 'rest.blockware.com/v1/api':
            case 'rest.blockware.com/v1/client':
            case 'grpc.blockware.com/v1/api':
            case 'grpc.blockware.com/v1/client':
                return this.compareMethods(newResource.spec.methods, oldResource.spec.methods);
        }

        if (!_.isEqual(oldResource.spec, newResource.spec)) {
            //Old specs are empty - major change
            return  BlockVersionCalculator.MAJOR;
        }

        return BlockVersionCalculator.NONE;
    }

    /**
     * Compares API Resource methods and determines the required version increment
     * 
     * Note: This should be moved to API Resource providers
     * 
     * @param {APIResourceMethodMap} newMethods
     * @param {APIResourceMethodMap} oldMethods
     */
    compareMethods(newMethods, oldMethods) {
        const oldMethodIds = Object.keys(oldMethods);

        for(let i = 0 ; i < oldMethodIds.length; i++) {
            const oldMethodId = oldMethodIds[i];
            if (!newMethods[oldMethodId]) {
                //Old method was removed
                return BlockVersionCalculator.MAJOR;
            }

            /**
             * @type {APIResourceMethod}
             */
            const oldMethod = oldMethods[oldMethodId];
            const newMethod = newMethods[oldMethodId];

            //Ignore description changes
            delete oldMethod.description;
            delete newMethod.description;

            if (_.isEqual(oldMethod, newMethod)) {
                continue;
            }

            if (!_.isEqual(oldMethod.arguments, newMethod.arguments)) {
                //Method arguments changed
                return BlockVersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.responseType, newMethod.responseType)) {
                //Response type changed
                return BlockVersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.method, newMethod.method)) {
                //Method changed
                return BlockVersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.path, newMethod.path)) {
                //Path changed
                return BlockVersionCalculator.MAJOR;
            }
        }

        const newMethodIds = Object.keys(newMethods);

        for(let i = 0 ; i < newMethodIds.length; i++) {
            const newMethodId = newMethodIds[i];

            if (!oldMethods[newMethodId]) {
                //Method was added
                return BlockVersionCalculator.MINOR;
            }
        }

        return BlockVersionCalculator.NONE;
    }

    /**
     * Compares lists of entities and determines the required version increment
     * 
     * @param {BlockEntityDefinition[]} newEntitiesList
     * @param {BlockEntityDefinition[]} oldEntitiesList
     * @returns {VersionDiffType}
     */
    compareEntities(newEntitiesList, oldEntitiesList) {
        
        const oldEntities = {};
        const newEntities = {};
        if (newEntitiesList) {
            newEntitiesList.forEach((entity) => {
                newEntities[entity.name] = entity;
            });
        }

        if (oldEntitiesList) {
            oldEntitiesList.forEach((entity) => {
                oldEntities[entity.name] = entity;
            });
        }

        const oldEntityNames = Object.keys(oldEntities);

        for(let i = 0 ; i < oldEntityNames.length; i++) {
            const oldEntityName = oldEntityNames[i];
            if (!newEntities[oldEntityName]) {
                //Old entity was removed
                return BlockVersionCalculator.MAJOR;
            }
            
            const oldEntity = oldEntities[oldEntityName];
            const newEntity = newEntities[oldEntityName];
            
            if (!_.isEqual(oldEntity, newEntity)) {
                //Existing entity changed
                return BlockVersionCalculator.MAJOR;
            }
        }

        const newEntityNames = Object.keys(newEntities);

        for(let i = 0 ; i < newEntityNames.length; i++) {
            const newEntityName = newEntityNames[i];

            if (!oldEntities[newEntityName]) {
                //Entity was added
                return BlockVersionCalculator.MINOR;
            }
        }

        return BlockVersionCalculator.NONE;
    }

    /**
     * Convert block resource definition list to map for easier comparison
     * 
     * @param {BlockResourceDefinition[]} resources
     * @returns {{[string]:BlockResourceDefinition}}
     * @private
     */
    static _asResourceMap(resources) {
        const out = {};
        if (resources) {
            resources.forEach((resource) => {
                const id = resource.kind + ':' + resource.metadata.name;
                if (out[id]) {
                    throw new Error(`Found 2 identical resources: ${id}. Make sure your resources are uniquely named per kind.`);
                }
                out[id] = resource;
            })
        }
        return out;
    }
}


/**
 *
 * @type {VersionDiffType}
 */
BlockVersionCalculator.MAJOR = 'MAJOR';

/**
 *
 * @type {VersionDiffType}
 */
BlockVersionCalculator.MINOR = 'MINOR';

/**
 *
 * @type {VersionDiffType}
 */
BlockVersionCalculator.PATCH = 'PATCH';

/**
 *
 * @type {VersionDiffType}
 */
BlockVersionCalculator.NONE = 'NONE';


module.exports = BlockVersionCalculator;