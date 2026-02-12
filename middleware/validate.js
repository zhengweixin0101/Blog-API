const Joi = require('joi');

// 登录验证
const loginSchema = Joi.object({
    username: Joi.string().min(1).max(100).required(),
    password: Joi.string().min(1).required(),
    turnstileToken: Joi.string().optional()
});

// 文章验证
const articleSchema = Joi.object({
    slug: Joi.string().min(1).max(200).required(),
    title: Joi.string().allow('').max(500).optional(),
    content: Joi.string().allow('').optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    description: Joi.string().allow(null, '').max(1000).optional(),
    date: Joi.date().iso().allow(null).optional(),
    published: Joi.boolean().optional()
});

// 编辑文章验证
const editArticleSchema = Joi.object({
    slug: Joi.string().min(1).max(200).required(),
    title: Joi.string().allow('').max(500).optional(),
    content: Joi.string().allow('').optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    description: Joi.string().allow(null, '').max(1000).optional(),
    date: Joi.date().iso().allow(null).optional(),
    published: Joi.boolean().optional()
});

// 编辑 slug 验证
const editSlugSchema = Joi.object({
    oldSlug: Joi.string().min(1).max(200).required(),
    newSlug: Joi.string().min(1).max(200).required()
});

// 删除文章验证
const deleteArticleSchema = Joi.object({
    slug: Joi.string().min(1).max(200).required()
});

// 说说验证
const talkSchema = Joi.object({
    content: Joi.string().min(1).required(),
    location: Joi.string().allow(null, '').max(200).optional(),
    links: Joi.array().items(Joi.object()).optional(),
    imgs: Joi.array().items(Joi.object({
        alt: Joi.string().required(),
        url: Joi.string().uri().required()
    })).optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

// 编辑说说验证
const editTalkSchema = Joi.object({
    id: Joi.number().integer().positive().required(),
    content: Joi.string().min(1).optional(),
    location: Joi.string().allow(null, '').max(200).optional(),
    links: Joi.array().items(Joi.object()).optional(),
    imgs: Joi.array().items(Joi.object({
        alt: Joi.string().required(),
        url: Joi.string().uri().required()
    })).optional(),
    tags: Joi.array().items(Joi.string()).optional()
});

// 删除说说验证
const deleteTalkSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

// 修改账号验证
const updateAccountSchema = Joi.object({
    username: Joi.string().min(1).max(100).optional(),
    password: Joi.string().min(1).optional(),
    currentPassword: Joi.string().required()
}).or('username', 'password');

// Token 删除验证
const deleteTokenSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

// Token 创建验证
const createTokenSchema = Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow('', null),
    expiresIn: Joi.number()
        .integer()
        .min(1)
        .default(259200000),
    permissions: Joi.array().items(
        Joi.string().valid(
            'article:write',
            'article:delete',
            'talk:write',
            'talk:delete'
        )
    ).min(1).default(['article:write', 'article:delete', 'talk:write', 'talk:delete'])
});

// 设置配置验证
const setConfigSchema = Joi.object({
    key: Joi.string().min(1).max(200).required(),
    value: Joi.any().required(),
    description: Joi.string().allow(null, '').max(500).optional()
});

// 获取配置验证
const getConfigSchema = Joi.object({
    key: Joi.string().min(1).max(200).required()
});

/**
 * 验证中间件
 * @param {Joi.Schema} schema - Joi 验证模式
 * @param {string} property - 要验证的请求属性 (body, query, params)
 */
function validate(schema, property = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            return res.status(400).json({
                success: false,
                error: '缺少必须的请求参数',
                details: error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }

        req[property] = value;
        next();
    };
}

module.exports = {
    validate,
    loginSchema,
    articleSchema,
    editArticleSchema,
    editSlugSchema,
    deleteArticleSchema,
    talkSchema,
    editTalkSchema,
    deleteTalkSchema,
    updateAccountSchema,
    deleteTokenSchema,
    createTokenSchema,
    setConfigSchema,
    getConfigSchema
};
