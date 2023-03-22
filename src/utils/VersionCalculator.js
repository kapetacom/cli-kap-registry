const _ = require('lodash');

class VersionCalculator {


    /**
     *
     * @param version
     * @returns {VersionInfo}
     */
    static parseVersion(version) {
        let [major, minor, patch] = version.split(/\./g);
        let preRelease = null;
        const preReleaseIx = patch.indexOf('-');
        if (preReleaseIx > -1) {
            preRelease = patch.substring(preReleaseIx + 1);
            patch = patch.substring(0, preReleaseIx);
        }

        return {
            major: parseInt(major),
            minor: parseInt(minor),
            patch: parseInt(patch),
            preRelease,
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
            toMajorVersion() {
                let out = `${this.major}`;

                if (this.preRelease) {
                    out += '-' + this.preRelease;
                }
                return out;
            },
            toMinorVersion() {
                let out = `${this.major}.${this.minor}`;

                if (this.preRelease) {
                    out += '-' + this.preRelease;
                }
                return out;
            },
            toFullVersion() {
                let out = `${this.major}.${this.minor}.${this.patch}`;

                if (this.preRelease) {
                    out += '-' + this.preRelease;
                }
                return out;
            },
            toString() {
                return this.toFullVersion();
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
        const versionInfo = VersionCalculator.parseVersion(version);

        switch (incrementType) {
            case VersionCalculator.MAJOR:
                versionInfo.major++;
                versionInfo.minor = 0;
                versionInfo.patch = 0;
                return versionInfo.toString();

            case VersionCalculator.MINOR:
                versionInfo.minor++;
                versionInfo.patch = 0;
                return versionInfo.toString();

            case VersionCalculator.PATCH:
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
        const fromVersionInfo = VersionCalculator.parseVersion(versionA);
        const toVersionInfo = VersionCalculator.parseVersion(versionB);
        if (fromVersionInfo.major !== toVersionInfo.major) {
            return VersionCalculator.MAJOR;
        }

        if (fromVersionInfo.minor !== toVersionInfo.minor) {
            return VersionCalculator.MINOR;
        }

        if (fromVersionInfo.patch !== toVersionInfo.patch) {
            return VersionCalculator.PATCH;
        }

        return VersionCalculator.NONE;
    }

    /**
     * Determines in typeA is a bigger version bump than typeB
     *
     * @param {VersionDiffType} typeA
     * @param {VersionDiffType} typeB
     * @returns {boolean}
     */
    static isIncrementGreaterThan(typeA, typeB) {
        const a = VersionCalculator.typeToNumber(typeA);
        const b = VersionCalculator.typeToNumber(typeB);

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

        return VersionCalculator.incrementVersionBy(newDefinition.metadata.version, versionDiffRequired);
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
            return VersionCalculator.MAJOR;
        }

        if (_.isEmpty(newDefinition.spec) && _.isEmpty(existingDefinition.spec)) {
            return VersionCalculator.NONE;
        }

        if (_.isEmpty(newDefinition.spec) && !_.isEmpty(existingDefinition.spec)) {
            //Spec was removed
            return VersionCalculator.MAJOR;
        }

        if (!newDefinition.spec) {
            newDefinition.spec = {};
        }

        //TODO: Comparing block definitions should be moved to block kind providers
        const entityMatchType = this.compareEntities(newDefinition.spec.entities, existingDefinition.spec.entities);
        if (entityMatchType === VersionCalculator.MAJOR) {
            return entityMatchType;
        }

        const newConsumers = VersionCalculator._asResourceMap(newDefinition.spec.consumers);
        const oldConsumers = VersionCalculator._asResourceMap(existingDefinition.spec.consumers);

        const consumerMatchType = this.compareResourceMaps(newConsumers, oldConsumers);

        if (consumerMatchType === VersionCalculator.MAJOR) {
            return consumerMatchType;
        }

        const newProviders = VersionCalculator._asResourceMap(newDefinition.spec.providers);
        const oldProviders = VersionCalculator._asResourceMap(existingDefinition.spec.providers);

        const providerMatchType = this.compareResourceMaps(newProviders, oldProviders);

        if (providerMatchType === VersionCalculator.MAJOR) {
            return VersionCalculator.MAJOR;
        }

        if (entityMatchType === VersionCalculator.MINOR ||
            consumerMatchType === VersionCalculator.MINOR ||
            providerMatchType === VersionCalculator.MINOR) {
            return VersionCalculator.MINOR;
        }

        if (entityMatchType === VersionCalculator.PATCH ||
            consumerMatchType === VersionCalculator.PATCH ||
            providerMatchType === VersionCalculator.PATCH) {
            return VersionCalculator.PATCH;
        }

        return VersionCalculator.NONE;
    }

    /**
     * Compares resource maps and determines the required version increment
     * 
     * @param {{[string]:BlockResourceDefinition}} newResources
     * @param {{[string]:BlockResourceDefinition}} oldResources
     * @returns {VersionDiffType}
     */
    compareResourceMaps(newResources, oldResources) {
        let out = VersionCalculator.NONE;

        if (_.isEqual(newResources, oldResources)) {
            return out;
        }

        const oldKeys = Object.keys(oldResources);

        for(let i = 0; i < oldKeys.length; i++) {
            const oldKey = oldKeys[i];

            if (!newResources[oldKey]) {
                //Resource has been removed - major change
                return VersionCalculator.MAJOR;
            }

            const oldResource = oldResources[oldKey];
            const newResource = newResources[oldKey];

            const resourceDiffType = this.compareResources(newResource, oldResource);

            if (resourceDiffType === VersionCalculator.MAJOR) {
                return resourceDiffType;
            }

            if (resourceDiffType === VersionCalculator.MINOR) {
                out = VersionCalculator.MINOR;
            }
        }

        const newKeys = Object.keys(newResources);

        for(let i = 0; i < newKeys.length; i++) {
            const newKey = newKeys[i];

            if (!oldResources[newKey]) {
                //Resource has been added - minor change
                out = VersionCalculator.MINOR;
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
            return VersionCalculator.NONE;
        }

        if (oldResource.metadata.name !== newResource.metadata.name) {
            //Changed the name of existing resource - major change
            return VersionCalculator.MAJOR;
        }

        if (!oldResource.spec &&
            !newResource.spec) {
            return VersionCalculator.NONE;
        }

        if (!_.isEmpty(oldResource.spec) && _.isEmpty(newResource.spec)) {
            //New specs are empty - major change
            return VersionCalculator.MAJOR;
        }

        if (_.isEmpty(oldResource.spec) && !_.isEmpty(newResource.spec)) {
            //Old specs are empty - major change
            return  VersionCalculator.MAJOR;
        }

        const kind = newResource.kind.toLowerCase();

        switch (kind) {
            //TODO: Special handling per resource kind should be moved to providers
            case 'rest.kapeta.com/v1/api':
            case 'rest.kapeta.com/v1/client':
            case 'grpc.kapeta.com/v1/api':
            case 'grpc.kapeta.com/v1/client':
                return this.compareMethods(newResource.spec.methods, oldResource.spec.methods);
        }

        if (!_.isEqual(oldResource.spec, newResource.spec)) {
            //Old specs are empty - major change
            return  VersionCalculator.MAJOR;
        }

        return VersionCalculator.NONE;
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
                return VersionCalculator.MAJOR;
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
                return VersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.responseType, newMethod.responseType)) {
                //Response type changed
                return VersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.method, newMethod.method)) {
                //Method changed
                return VersionCalculator.MAJOR;
            }

            if (!_.isEqual(oldMethod.path, newMethod.path)) {
                //Path changed
                return VersionCalculator.MAJOR;
            }
        }

        const newMethodIds = Object.keys(newMethods);

        for(let i = 0 ; i < newMethodIds.length; i++) {
            const newMethodId = newMethodIds[i];

            if (!oldMethods[newMethodId]) {
                //Method was added
                return VersionCalculator.MINOR;
            }
        }

        return VersionCalculator.NONE;
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
                return VersionCalculator.MAJOR;
            }
            
            const oldEntity = oldEntities[oldEntityName];
            const newEntity = newEntities[oldEntityName];
            
            if (!_.isEqual(oldEntity, newEntity)) {
                //Existing entity changed
                return VersionCalculator.MAJOR;
            }
        }

        const newEntityNames = Object.keys(newEntities);

        for(let i = 0 ; i < newEntityNames.length; i++) {
            const newEntityName = newEntityNames[i];

            if (!oldEntities[newEntityName]) {
                //Entity was added
                return VersionCalculator.MINOR;
            }
        }

        return VersionCalculator.NONE;
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
VersionCalculator.MAJOR = 'MAJOR';

/**
 *
 * @type {VersionDiffType}
 */
VersionCalculator.MINOR = 'MINOR';

/**
 *
 * @type {VersionDiffType}
 */
VersionCalculator.PATCH = 'PATCH';

/**
 *
 * @type {VersionDiffType}
 */
VersionCalculator.NONE = 'NONE';


module.exports = VersionCalculator;
