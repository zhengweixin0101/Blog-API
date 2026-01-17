/**
 * 统一响应格式工具
 */

/**
 * 成功响应
 * @param {*} data - 返回的数据
 * @param {string} message - 成功消息
 * @param {number} status - HTTP状态码 (默认200)
 */
function success(data, message = '操作成功', status = 200) {
    return {
        success: true,
        status,
        message,
        data
    };
}

/**
 * 错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP状态码
 * @param {*} details - 错误详情
 */
function error(message, status = 500, details = null) {
    const response = {
        success: false,
        status,
        error: message
    };
    if (details) {
        response.details = details;
    }
    return response;
}

/**
 * 分页响应
 * @param {Array} data - 数据列表
 * @param {Object} pagination - 分页信息
 * @param {string} message - 成功消息
 */
function paginated(data, pagination, message = '获取成功') {
    return success({
        ...pagination,
        items: data
    }, message);
}

module.exports = {
    success,
    error,
    paginated
};
