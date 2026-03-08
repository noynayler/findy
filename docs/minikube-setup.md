# Running Findy on Minikube (Windows)

This guide walks you through setting up Kubernetes locally with Minikube on Windows and deploying Findy.

## Prerequisites

- **Docker Desktop for Windows** (already installed and running)
- **PowerShell** or **Command Prompt** (run as Administrator for install steps)

## 1. Install kubectl

kubectl is the Kubernetes command-line client.

**Option A: Using Chocolatey** (if you have it):

```powershell
choco install kubernetes-cli
```

**Option B: Using winget**:

```powershell
winget install Kubernetes.kubectl
```

**Option C: Manual download**

1. Open https://github.com/kubernetes/kubectl/releases
2. Download the latest `kubectl.exe` for Windows (e.g. from the release assets)
3. Place it in a folder that is in your `PATH` (e.g. `C:\Windows` or create `C:\kubectl` and add it to PATH)

**Verify:**

```powershell
kubectl version --client
```

## 2. Install Minikube

**Option A: Using Chocolatey**

```powershell
choco install minikube
```

**Option B: Using winget**

```powershell
winget install Minikube.Minikube
```

**Option C: Manual download**

1. Open https://github.com/kubernetes/minikube/releases
2. Download the latest `minikube-windows-amd64.exe`
3. Rename it to `minikube.exe` and move it to a folder in your `PATH`

**Verify:**

```powershell
minikube version
```

## 3. Start Minikube

From a terminal (no need for Administrator):

```powershell
minikube start --driver=docker
```

This uses your existing Docker Desktop. The first run may take a few minutes.

Check that the cluster is running:

```powershell
kubectl cluster-info
kubectl get nodes
```

## 4. Deploy Findy

From the **project root** (`jobmatch-bot`):

```powershell
kubectl apply -f k8s/
```

You should see:

```
deployment.apps/findy created
service/findy created
```

Check that pods are running:

```powershell
kubectl get pods
kubectl get svc
```

Wait until both pods show `Running` and `1/1` Ready:

```powershell
kubectl get pods -w
```

Press `Ctrl+C` when both are ready.

## 5. Access the application

Minikube exposes the app via NodePort. Get the URL:

```powershell
minikube service findy --url
```

Copy the URL (e.g. `http://127.0.0.1:31234`) and open it in your browser. Or open the service in the default browser:

```powershell
minikube service findy
```

## 6. Useful commands

| Command | Description |
|--------|-------------|
| `minikube status` | Cluster status |
| `minikube stop` | Stop the cluster |
| `minikube start` | Start the cluster again |
| `minikube delete` | Remove the cluster |
| `kubectl get pods` | List Findy pods |
| `kubectl get svc` | List services |
| `kubectl logs -l app=findy -f` | Stream logs from Findy pods |
| `kubectl describe pod -l app=findy` | Pod details and events |

## 7. Using your own image (noya39/findy:v1)

If the image `noya39/findy:v1` is on Docker Hub, Minikube will pull it when you run `kubectl apply -f k8s/`. No extra steps are needed.

If you built the image only on your machine and did not push to Docker Hub, load it into Minikube’s Docker daemon:

```powershell
# Use Minikube's Docker so images built here are visible to Minikube (PowerShell)
minikube docker-env | Invoke-Expression
docker build -t noya39/findy:v1 .
kubectl apply -f k8s/
```

To switch your shell back to your normal Docker (e.g. Docker Desktop):

```powershell
minikube docker-env -u | Invoke-Expression
```

## Troubleshooting

- **Pods not starting**: Run `kubectl describe pod -l app=findy` and check the Events section. Often the image cannot be pulled (e.g. network or image name).
- **ImagePullBackOff**: If using a local image, build inside Minikube’s Docker (`eval $(minikube docker-env)` then `docker build -t noya39/findy:v1 .`) or push `noya39/findy:v1` to Docker Hub and use that.
- **Minikube won’t start**: Ensure Docker Desktop is running and that Hyper-V or WSL2 (if used) is enabled as required by Docker.
