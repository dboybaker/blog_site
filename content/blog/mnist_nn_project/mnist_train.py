import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, random_split
import torch.nn as nn
import torch.nn.functional as F

transform = transforms.Compose([
    transforms.ToTensor(),                       # image -> tensor, scales pixels to [0.0, 1.0]
    transforms.Normalize((0.1307,), (0.3081,)),  # subtract mean, divide by std (MNIST's known stats)
])

train_data = datasets.MNIST(root="./data", train=True,  download=True, transform=transform)
test_data  = datasets.MNIST(root="./data", train=False, download=True, transform=transform)

# pre select 10% of the training set for validation
train_subset, val_subset = random_split(
    train_data, [54000, 6000],
    generator=torch.Generator().manual_seed(19) #set the seed to ensure selected data remains constant
)

#Dataloader handles the batch grouping,shuffling, and iteration
train_loader = DataLoader(train_subset, batch_size=64, shuffle=True)
val_loader   = DataLoader(val_subset,   batch_size=1000, shuffle=False)
test_loader  = DataLoader(test_data,  batch_size=1000, shuffle=False)

images, labels = next(iter(train_loader))

#Build the MLP
class MLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(28 * 28, 128)   # 784 inputs -> 128 hidden
        self.fc2 = nn.Linear(128, 64)        # 128 -> 64 hidden
        self.fc3 = nn.Linear(64, 10)         # 16 -> 10 logits output (one per digit)

    def forward(self, x):
        x = x.view(x.size(0), -1)   # flatten [64, 1, 28, 28] -> [64, 784]
        x = F.relu(self.fc1(x))     # layer 1 + activation
        x = F.relu(self.fc2(x))     # layer 2 + activation
        x = self.fc3(x)             # output logits
        return x

#Build a CNN for comparison to MLP
class CNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)   # 1 channel in, 32 feature maps out
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)  # 32 -> 64 feature maps
        self.pool  = nn.MaxPool2d(2, 2)                           # halves height & width
        self.fc1   = nn.Linear(64 * 7 * 7, 128)
        self.fc2   = nn.Linear(128, 10)
        self.dropout = nn.Dropout(0.25)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x)))   # [B,1,28,28] -> [B,32,14,14]
        x = self.pool(F.relu(self.conv2(x)))   # [B,32,14,14] -> [B,64,7,7]
        x = x.view(x.size(0), -1)              # flatten -> [B, 64*7*7 = 3136]
        x = F.relu(self.fc1(x))
        x = self.dropout(x)                    # randomly zero 25% of activations (regularization)
        x = self.fc2(x)
        return x

#method for evals
def evaluate(model, loader):
    model.eval()                       # eval mode (disables dropout, etc)
    correct = total = 0
    with torch.no_grad():              # disable building the autograd graph for eval
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            predicted = outputs.argmax(dim=1)   # index of highest logit = predicted digit
            correct += (predicted == labels).sum().item()
            total += labels.size(0)
    return 100 * correct / total

#Loss and optimizer
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = MLP().to(device)

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3) #try Adam (most efficient)
#optimizer = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9) #try Stochastic Gradient Descent
epochs = 5

val_acc = evaluate(model, val_loader)
print(f"Epoch 0  val acc {val_acc:.2f}%")   #view accuracy before training

for epoch in range(epochs):
    model.train()
    running_loss = 0.0

    for images, labels in train_loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()               # 1. clear old gradients
        outputs = model(images)             # 2. forward pass -> logits
        loss = criterion(outputs, labels)   # 3. how wrong is the prediction?
        loss.backward()                     # 4. backprop: compute gradients
        optimizer.step()                    # 5. nudge weights downhill

        running_loss += loss.item()
    val_acc = evaluate(model, val_loader)
    print(f"Epoch {epoch+1}: loss {running_loss/len(train_loader):.4f}  val acc {val_acc:.2f}%")

#torch.save(model.state_dict(), "mnist.pt")     #uncomment to save the final state to load later

print(f"Test accuracy: {evaluate(model, test_loader):.2f}%")