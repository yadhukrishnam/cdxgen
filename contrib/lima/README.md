# Introduction

[Lima](https://lima-vm.io/) launches Linux virtual machines with automatic file sharing and port forwarding (similar to WSL2).

## Getting Started

Use the below command to create a cdxgen vm.

```shell
brew install lima
git clone https://github.com/CycloneDX/cdxgen.git
cd cdxgen
# The below command might take several minutes
limactl start --name=cdxgen contrib/lima/cdxgen-opensuse.yaml --tty=false
```

Sample output

```shell
❯ limactl start --name=cdxgen contrib/lima/cdxgen-opensuse.yaml --tty=false
INFO[0000] Terminal is not available, proceeding without opening an editor
INFO[0000] Starting the instance "cdxgen" with VM driver "qemu"
INFO[0000] QEMU binary "/usr/local/bin/qemu-system-x86_64" seems properly signed with the "com.apple.security.hypervisor" entitlement
INFO[0000] Attempting to download the image              arch=x86_64 digest= location="https://download.opensuse.org/distribution/leap/15.6/appliances/openSUSE-Leap-15.6-Minimal-VM.x86_64-Cloud.qcow2"
INFO[0000] Using cache "/Users/user/Library/Caches/lima/download/by-url-sha256/df847b33b9afd652992e2d5ad084eaf97a93ee54f6957c288a643f3c11fdde1c/data"
INFO[0000] Attempting to download the nerdctl archive    arch=x86_64 digest="sha256:2c841e097fcfb5a1760bd354b3778cb695b44cd01f9f271c17507dc4a0b25606" location="https://github.com/containerd/nerdctl/releases/download/v1.7.6/nerdctl-full-1.7.6-linux-amd64.tar.gz"
INFO[0000] Using cache "/Users/user/Library/Caches/lima/download/by-url-sha256/b86908f1f5ea2af45aec405f0fd389eba1999b51e3972ca78215ace94d2da2a6/data"
INFO[0001] [hostagent] hostagent socket created at /Users/user/.lima/cdxgen/ha.sock
INFO[0001] [hostagent] Using system firmware ("/usr/local/share/qemu/edk2-x86_64-code.fd")
INFO[0001] [hostagent] Starting QEMU (hint: to watch the boot progress, see "/Users/user/.lima/cdxgen/serial*.log")
INFO[0002] SSH Local Port: 61020
INFO[0001] [hostagent] Waiting for the essential requirement 1 of 4: "ssh"
```

To open a shell to the cdxgen VM:

```shell
limactl shell cdxgen
```

To stop the VM:

```shell
limactl stop cdxgen
```