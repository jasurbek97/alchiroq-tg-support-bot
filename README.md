# Alchiroq support telegram bot 
### Used: 
Laravel for operator ui \
Nest js for web socket 
### Deploy 
```
pm2 start socket/dist/main.js --name chat_back

pm2 start chat_bot/index.js --name bot
```