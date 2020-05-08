const Git = require('simple-git/promise');
const _ = require('lodash');

/**
 * @implements {VCSHandler}
 */
class GitHandler {

    /**
     * Determines if folder is a git repository
     * @param {string} directory
     * @returns {Promise<boolean>}
     */
    static async isRepo(directory) {
        return await Git(directory).checkIsRepo();
    }

    /**
     * Get type of handler
     *
     * @returns {string}
     */
    static getType() {
        return 'GIT';
    }

    /**
     *
     * @param {CLIHandler} cli
     */
    constructor(cli) {
        this._cli = cli;
    }

    getName() {
        return 'Git';
    }

    getType() {
        return 'GIT';
    }

    async add(directory, filename) {
        await Git(directory).add(filename);
    }

    async commit(directory, message) {
        await Git(directory).commit(message);
        //Return type from commit only includes the short-form commit hash. We want the full thing
        return this.getLatestCommit(directory);
    }

    async push(directory, includeTags) {

        const [remote, branch] = await this.getRemote(directory);

        this._cli.debug('Pushing changes to Git remote: %s/%s', remote, branch);

        const git = Git(directory);

        await git.push(remote, branch);

        if (includeTags) {
            await git.pushTags(remote);
        }

    }

    async getTagsForLatest(directory) {
        const git = Git(directory);

        const tag = await git.tag();
        if (!tag) {
            return [];
        }

        return tag
            .trim()
            .split(/\n/g)
            .map((tag) => tag.trim());
    }

    async tag(directory, tag) {
        const git = Git(directory);

        const existingTags = await this.getTagsForLatest(directory);

        if (existingTags.indexOf(tag) > -1) {
            //Tag already exists - ignore
            return false;
        }

        await git.addTag(tag);

        return true;
    }

    async isWorkingDirectoryClean(directory) {
        const git = Git(directory);

        //Update remotes
        await git.raw(['remote', 'update']);

        //Check status
        const status = await git.status();

        const trackedFiles = status.files.filter((file) => file.index !== '?');

        return trackedFiles.length === 0;
    }

    async isWorkingDirectoryUpToDate(directory) {
        const git = Git(directory);
        //Update remotes
        await git.raw(['remote', 'update']);

        //Check status
        const status = await git.status();

        return status.behind === 0;
    }

    async getBranch(directory) {
        const status = await Git(directory).status();
        return status.current;
    }

    async getLatestCommit(directory) {
        const logs = await Git(directory).log({n:1});

        if (logs.latest &&
            logs.latest.hash) {
            return logs.latest.hash
        }

        return null;
    }

    async getCheckoutInfo(directory) {

        const [remote, branch] = await this.getRemote(directory);

        const git = Git(directory);
        const remotes = await git.getRemotes(true);

        //git rev-parse --show-toplevel
        const topLevelDir = await git.revparse(['--show-toplevel']);
        let relativePath;
        if (directory.indexOf(topLevelDir) === 0) {
            relativePath = directory.substr(topLevelDir.length + 1);
        }

        if (!relativePath || relativePath === '/') {
            relativePath = '.';
        } else if (!relativePath.startsWith('./')) {
            relativePath = './' + relativePath
        } else if (!relativePath.startsWith('.')) {
            relativePath = '.' + relativePath
        }

        const remoteInfo = _.find(remotes, {name: remote});

        if (remoteInfo.refs &&
            remoteInfo.refs.fetch) {
            return {
                url: remoteInfo.refs.fetch,
                remote: remote,
                branch: branch,
                path: relativePath
            };
        }

        throw new Error('Failed to identify remote checkout url to use. Verify that your local repository is properly configured.');
    }

    async getRemote(directory) {
        const git = Git(directory);
        const status = await git.status();

        if (status.tracking) {
            return status.tracking.trim().split(/\//);
        }

        const remotes = await git.getRemotes(true);
        const branch = status.current;

        if (remotes.length === 0) {
            throw new Error('No remotes defined for git repository.');
        }

        if (remotes.length === 1) {
            return [
                remotes[0].name,
                branch
            ];
        }

        if (remotes.length > 1) {
            //Multiple remotes - let's first look for origin
            const originRemote = _.find(remotes, {name:'origin'});
            if (originRemote) {
                //We check for origin first - that's the most commonly used name for remotes
                return [
                    originRemote.name,
                    branch
                ];
            }

            //If origin not found - let's look for known cloud providers like Github
            const cloudRemote = _.find(remotes, (remote) => {
                return remote.refs &&
                        remote.refs.push &&
                        /bitbucket|github|gitlab/i.test(remote.refs.push);
            });

            if (cloudRemote) {
                //We check for origin first - that's the most commonly used name for remotes
                return [
                    originRemote.name,
                    branch
                ];
            }
        }

        throw new Error('Failed to identify remote to use and local branch is not tracking any.');

    }

    /**
     *
     * @param {GitCheckoutInfo} checkoutInfo
     * @param {string} commitId
     * @param {string} targetFolder
     * @returns {Promise<void>}
     */
    async clone(checkoutInfo, commitId, targetFolder) {
        const git = Git();

        await this._cli.progress(`Cloning GIT repository ${checkoutInfo.url} to ${targetFolder}`, async () => {
            await git.clone(checkoutInfo.url, targetFolder);
        });

        const gitRepo = Git(targetFolder);

        await this._cli.progress(`Checking out commit ${commitId}`, async () => {
            await gitRepo.checkout(commitId);
        });
    }
}

module.exports = GitHandler;