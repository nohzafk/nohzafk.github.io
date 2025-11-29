---
title: Using Flask and python-telegram-bot to Build a Webhook for Telegram Bots
date: 2023-10-21
tags: [python, telegram, devops]
---

## Introduction

This code example demonstrates how to use Python's Flask framework and the python-telegram-bot library (version 13.0) to build a webhook for a Telegram bot. We will utilize the Google Cloud Run container to handle incoming messages and invoke the bot without long polling.

```python
from flask import Flask, request, jsonify
from telegram import Bot, Update
from telegram.ext import Dispatcher
import requests

app = Flask(__name__)
bot = Bot(token="YOUR_BOT_TOKEN_HERE")
dispatcher = Dispatcher(bot, None, workers=0, use_context=True)

```

## Defining the Message Handler

To handle incoming messages, we define a function called `photo_handler` that will be used as a handler for photo messages.

```python
def photo_handler(update: Update, context):
    user_id = update.message.from_user.id
    owner_id = 123456789  # Replace with your user_id

    if user_id == owner_id:
        file_id = update.message.photo[-1].file_id  # Get the highest-resolution photo
        file_info = bot.get_file(file_id)
        file_url = file_info.file_path
        
        # Download the file (assuming you have 'requests' installed)
        response = requests.get(file_url)
        with open("received_photo.jpg", "wb") as f:
            f.write(response.content)
```

## Setting up the Webhook Endpoint

We define a route for the `/webhook` endpoint using the `@app.route` decorator. This endpoint will receive incoming updates from Telegram.

```python
@app.route('/webhook', methods=['POST'])
def webhook():
    update = Update.de_json(request.get_json(), bot)
    dispatcher.process_update(update)
    return jsonify(success=True)
```

## Adding the Message Handler to the Dispatcher

We add the `photo_handler` function as a message handler using the `MessageHandler` class from the `telegram.ext` module. We specify the `Filters.photo` filter to only handle photo messages.

```python
if __name__ == "__main__":
    from telegram.ext import MessageHandler, Filters
    
    photo_handler = MessageHandler(Filters.photo, photo_handler)
    dispatcher.add_handler(photo_handler)
    app.run(port=5000)
```

## Conclusion

By using Flask and the python-telegram-bot library, we can easily build a webhook for a Telegram bot. This allows us to handle incoming messages efficiently using a Google Cloud Run container instead of using long polling.