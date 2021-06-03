require('dotenv').config()
const Telegraf = require('telegraf')
const Markup = require('telegraf/markup')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const WizardScene = require('telegraf/scenes/wizard')
const Composer = require('telegraf/composer')
const Session = require('./session')
const socket = require('./socket-api')
const TelegrafI18n = require('telegraf-i18n')
const path = require('path');
const {match} = TelegrafI18n;

const db_credentials = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DB,
    port: process.env.DB_PORT,

}

const knex = (require('knex')({
    client: 'pg',
    connection: db_credentials,
    searchPath: ['knex', 'public'],
}))

const session = new Session(db_credentials)
const i18n = new TelegrafI18n({
    defaultLanguage: 'ru',
    allowMissing: false,
    directory: path.resolve(__dirname, 'locales'),
    useSession: true
})

const bot = new Telegraf(process.env.BOT_TOKEN)

const registerScene = new WizardScene(
    'register-scene',
    ctx => {
        ctx.reply(
            'Здравствуйте! Давайте для начала выберем язык обслуживания!\n\nKeling, avvaliga xizmat ko’rsatish tilini tanlab olaylik.',
            Markup.keyboard([
                '🇺🇿 O\'zbekcha',
                '🇷🇺 Русский',
            ], {columns: 1}).resize().extra()
        )
        ctx.wizard.next()
    },
    (new Composer())
        .hears('🇺🇿 O\'zbekcha', async ctx => {
            ctx.scene.state.lang = 'uz';
            setLanguage(ctx, 'uz')
            ctx.replyWithMarkdown(
                ctx.i18n.t('enter-name'),
                Markup.removeKeyboard().extra()
            );
            ctx.wizard.next();
        })
        .hears('🇷🇺 Русский', async ctx => {
            ctx.scene.state.lang = 'ru';
            setLanguage(ctx, 'ru')
            ctx.replyWithMarkdown(
                ctx.i18n.t('enter-name'),
                Markup.removeKeyboard().extra()
            );
            ctx.wizard.next();
        }),
    async ctx => {
        ctx.scene.state.name = ctx.message.text;
        ctx.replyWithMarkdown(
            ctx.i18n.t('send-number'),
            Markup.keyboard([
                Markup.contactRequestButton(ctx.i18n.t('my-number'))
            ]).resize().extra()
        );
        ctx.wizard.next();
    },
    async ctx => {
        if (!ctx.message.contact) {
            return;
        }
        let phone = ctx.message.contact.phone_number.replace(/\+/, '');

        let chat = await knex('chats').where({
            chat_id: ctx.from.id
        }).first();

        if (!chat) {
            await knex('chats').insert({
                system: 'telegram',
                registered_date: new Date(),
                chat_id: ctx.from.id,
                name: ctx.scene.state.name,
                username: ctx.from.username,
                phone: phone,
                lang: ctx.scene.state.lang
            });
        }

        await ctx.replyWithMarkdown(ctx.i18n.t('thanks-reg'));
        ctx.scene.leave();
        return routes.start(ctx);
    }
)

const moment = require('moment');

const ignored_msgs = [
    'ask',
    'settings',
    'faq',
    'ios',
    'android'
]

const askScene = new WizardScene(
    'ask-scene',
    async ctx => {
        ctx.replyWithMarkdown(
            ctx.i18n.t('send-question'),
            Markup.keyboard([
                ctx.i18n.t('back')
            ]).resize().extra()
        );
        ctx.wizard.next()
    },
    new Composer()
        .hears([match('back'), '/start', '/menu'], async ctx => {
            ctx.scene.leave();
            return routes.start(ctx)
        })
        .on('text', async (ctx, next) => {
            if (ignored_msgs.some(msg => match(msg)(ctx.message.text, ctx))) {
                return next(ctx);
            }

            // if (!moment(new Date()).isBetween(moment('01:00', 'HH:mm'), moment('20:00', 'HH:mm')) && !ctx.scene.state.sent) {
            //     ctx.scene.state.sent = true;
            //     ctx.replyWithMarkdown(ctx.i18n.t('working-hours-long-text'))
            // }

            socket.emit('question', {
                from: ctx.from.id,
                text: ctx.message.text
            })
        })
        .on('photo', async (ctx, next) => {
            let photoUrl = await getPhotoUrl(ctx.message.photo);
            socket.emit('question', {
                from: ctx.from.id,
                text: photoUrl
            })
        })
        .on('location', async (ctx, next) => {
            // if (!moment(new Date()).isBetween(moment('09:00', 'hh:mm'), moment('20:00', 'hh:mm')) && !ctx.scene.state.sent) {
            //   ctx.scene.state.sent = true;
            //   ctx.replyWithMarkdown(ctx.i18n.t('working-hours-long-text'))
            // }

            socket.emit('question', {
                from: ctx.from.id,
                text: `https://www.google.com/maps/@${ctx.message.location.latitude},${ctx.message.location.longitude},16z`
            }, data => console.log(data))
        })
)


const settingsScene = new WizardScene(
    'settings-scene',
    async ctx => {
        ctx.scene.state.mode = null;
        ctx.replyWithMarkdown(
            ctx.i18n.t('settings'),
            Markup.keyboard([
                ctx.i18n.t('change-lang'),
                ctx.i18n.t('change-name'),
                ctx.i18n.t('change-number'),
                ctx.i18n.t('back'),
            ], {columns: 2}).resize().extra()
        )
        ctx.wizard.next()
    },
    new Composer()
        .hears(match('back'), ctx => {
            if (ctx.scene.state.mode) {
                return ctx.scene.enter('settings-scene');
            }
            ctx.scene.leave();
            return routes.start(ctx);
        })
        .hears(match('change-name'), ctx => {
            ctx.scene.state.mode = 'change-name';
            ctx.replyWithMarkdown(
                ctx.i18n.t('enter-your-name'),
            );
        })
        .hears(match('change-lang'), ctx => {
            ctx.scene.state.mode = 'change-lang';
            ctx.reply(
                ctx.i18n.t('change-lang'),
                Markup.keyboard([
                    '🇺🇿 O\'zbekcha',
                    '🇷🇺 Русский',
                    ctx.i18n.t('back')
                ], {columns: 1}).resize().extra()
            )
        })
        .hears(match('change-number'), ctx => {
            ctx.scene.state.mode = 'change-phone';
            ctx.replyWithMarkdown(
                ctx.i18n.t('enter-your-phone'),
                Markup.keyboard([
                    Markup.contactRequestButton(ctx.i18n.t('my-number')),
                    ctx.i18n.t('back')
                ], {columns: 1}).resize().extra()
            );
        })
        .on('text', async (ctx, next) => {
            if (ctx.scene.state.mode == 'change-name') {
                await knex('chats').where({
                    chat_id: ctx.from.id
                }).update({
                    name: ctx.message.text
                })
                ctx.replyWithMarkdown(ctx.i18n.t('your-name-has-updated'));
                ctx.scene.leave();
                return routes.start(ctx)
            }
            return next(ctx);
        })
        .on('contact', async (ctx) => {
            if (ctx.scene.state.mode == 'change-phone') {
                await knex('chats').where({
                    chat_id: ctx.from.id
                }).update({
                    phone: ctx.message.contact.phone_number.replace(/\+/, '')
                });
                ctx.replyWithMarkdown(ctx.i18n.t('your-phone-has-updated'));
                ctx.scene.leave();
                return routes.start(ctx)
            }
        })
)

const stage = new Stage([
    askScene,
    registerScene,
    settingsScene
])

const routes = {
    start: ctx => {
        ctx.replyWithMarkdown(
            ctx.i18n.t('welcome'),
            Markup.keyboard([
                ctx.i18n.t('ask'),
                ctx.i18n.t('faq'),
                ctx.i18n.t('ios'),
                ctx.i18n.t('android'),
                ctx.i18n.t('settings'),
            ], {columns: 2}).resize().extra()
        )
    }
}

bot.use((ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private')
        return;
    return next(ctx);
});

bot.use(session)
bot.use(i18n.middleware())

bot.use(async (ctx, next) => {
    let chat = await knex('chats').where({chat_id: ctx.from.id}).first();
    ctx.db_chat = chat;

    if (isBlocked(chat)) {
        let date = null;
        if (moment(chat.blocked_date).add(1, 'day') < moment(new Date()).add(5, 'day')) {
            date = moment(chat.blocked_date).add(1, 'day').format('DD.MM.YYYY HH:mm');
        }
        return ctx.replyWithMarkdown(ctx.i18n.t('blocked', {date: date}));
    }

    next(ctx);
})

bot.use(stage.middleware())

bot.use(async (ctx, next) => {
    if (!ctx.db_chat) {
        return ctx.scene.enter('register-scene');
    }

    return next(ctx)
});

bot.start(routes.start);

bot.hears(match('ask'), ctx => ctx.scene.enter('ask-scene'));
bot.hears(match('settings'), ctx => ctx.scene.enter('settings-scene'));


bot.hears(match('faq'), ctx => {
    ctx.replyWithMarkdown(ctx.i18n.t('faq-website') + '\nhttps://alchiroq.uz')
});

bot.hears(match('ios'), ctx => {
    ctx.replyWithMarkdown(ctx.i18n.t('link-to-app') + '\nhttps://apps.apple.com/app/id1499768234')
});

bot.hears(match('android'), ctx => {
    ctx.replyWithMarkdown(ctx.i18n.t('link-to-app') + '\nhttps://play.google.com/store/apps/details?id=com.ucell.aladdin')
});

bot.hears(match('change-lang'), ctx => {
    ctx.reply(
        ctx.i18n.t('change-lang'),
        Markup.keyboard([
            '🇺🇿 O\'zbekcha',
            '🇷🇺 Русский',
            ctx.i18n.t('back')
        ], {columns: 1}).resize().extra()
    )
});

bot.hears(match('back'), ctx => {
    ctx.scene.leave();
    routes.start(ctx);
})


bot.hears('🇺🇿 O\'zbekcha', async ctx => {
    setLanguage(ctx, 'uz')
    await knex('chats').where({
        chat_id: ctx.from.id
    }).update({
        lang: 'uz'
    })
    routes.start(ctx);
})


bot.hears('🇷🇺 Русский', async ctx => {
    setLanguage(ctx, 'ru')
    await knex('chats').where({
        chat_id: ctx.from.id
    }).update({
        lang: 'ru'
    })
    routes.start(ctx);
})

bot.on('text', ctx => {
    ctx.replyWithMarkdown(ctx.i18n.t('reminder'));
});

bot.launch();


socket.on('new_answer', async data => {
    let message = await knex('messages').where({id: data.id}).first();

    let chat = await knex('chats').where({id: message.recipient}).first();

    if (message.filename) {
        bot.telegram.sendDocument(
            chat.chat_id,
            {
                source: "/var/www/livechat/chat_ui/public/"+message.path,
                filename: message.filename
            },
            {
                caption: message.text || ''
            }
        ).catch(console.log)
    } else {
        bot.telegram.sendMessage(chat.chat_id, message.text);
    }
});

function setLanguage(ctx, code) {
    ctx.session.__language_code = code;
    ctx.i18n.locale(code);
}

function isBlocked(chat) {
    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1)
    return chat && chat.blocked && chat.blocked_date > yesterday;
}

async function getPhotoUrl(photo) {
    let file_id = photo[photo.length - 1].file_id
    let url = await bot.telegram.getFileLink(file_id)
    return url
}