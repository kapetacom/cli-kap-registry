# kap "registry" command

Enabled pushing, cloning, and pull image from kapeta registry

## Auto-versioning
The registry command automatically calculates the next semantic version whenever you push. 
This is done by comparing the block versions and the logic is as follows:
- If nothing is added, updated or removed in your kapeta.yml it will increment the patch version
- If nothing is updated or removed - but some things have been added in your kapeta.yml it will increment the minor version
- If anything is updated or removed in your kapeta.yml it will increment the major version

## Versioning validation
If you disable auto-versioning (```--auto-versioning false``) the command will still verify your version and perform 
the following checks:
- Ensure the version does not exist
- Verify your new version against the latest version - to make sure it follows proper semantic versioning (See auto-versioning paragraph for logic)    

## Configuration
The registry command has its own registry file in ```~/.kapeta/registry.yml```. The configuration
determines what kapeta and docker registry to use.

Example configuration can be seen below:
```yaml
registry:
  url: https://registry.kapeta.com
  organisationId: my-company
  docker:
    registry: my-private-docker-repo.com
```

The above configuration will result in all docker images being prefixed with ```my-private-docker-repo.com/my-company/```. 
E.g. for a block named ```users``` the docker image would be named ```my-private-docker-repo.com/my-company/users```. 

---

To use the default docker registry (DockerHub) omit the docker registry configuration:
```yaml
registry:
  url: https://registry.kapeta.com
  organisationId: my-company
```

```organisationId``` is used as part of the naming for docker images - this should be equivalent to your
DockerHub organisation name.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details