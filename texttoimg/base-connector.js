/**
 * SD Helper - 图像生成连接器基类
 * 定义所有模型连接器必须实现的标准接口
 */

const BaseConnector = {
    // ============ 连接器元数据 ============
    id: 'base',           // 唯一标识符
    name: '基础连接器',    // 显示名称
    description: '',      // 描述
    icon: '🔌',           // 图标

    // ============ 核心方法 ============

    /**
     * 测试连接是否正常
     * @param {Object} config - 连接器配置
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testConnection(config) {
        throw new Error('子类必须实现 testConnection 方法');
    },

    /**
     * 生成图片
     * @param {string} prompt - 正向提示词
     * @param {string} negative - 负向提示词
     * @param {Object} params - 生成参数 {width, height, steps, cfg, seed, ...}
     * @param {Object} config - 连接器配置
     * @returns {Promise<{success: boolean, imageUrl?: string, imageBase64?: string, error?: string}>}
     */
    async generate(prompt, negative, params, config) {
        throw new Error('子类必须实现 generate 方法');
    },

    // ============ 配置相关 ============

    /**
     * 获取默认配置
     * @returns {Object}
     */
    getDefaultConfig() {
        return {};
    },

    /**
     * 获取配置字段定义（用于动态生成UI）
     * @returns {Array<{key: string, label: string, type: string, placeholder?: string, options?: Array}>}
     */
    getConfigFields() {
        return [];
    },

    /**
     * 渲染配置界面 HTML
     * @param {Object} config - 当前配置
     * @returns {string} - HTML 字符串
     */
    renderConfigUI(config) {
        return '<div>未实现配置界面</div>';
    },

    /**
     * 从 UI 读取配置（根据连接器 ID 前缀）
     * @returns {Object} - 配置对象
     */
    parseConfigFromUI() {
        return {};
    },

    /**
     * 验证配置是否有效
     * @param {Object} config
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateConfig(config) {
        return { valid: true, errors: [] };
    }
};

// 连接器管理器
const ConnectorManager = {
    connectors: {},
    activeConnectorId: null,

    /**
     * 注册连接器
     * @param {Object} connector - 符合 BaseConnector 接口的对象
     */
    register(connector) {
        if (!connector.id) {
            console.error('[ConnectorManager] 连接器缺少 id 字段');
            return;
        }
        this.connectors[connector.id] = connector;
        console.log(`[ConnectorManager] 已注册连接器: ${connector.name} (${connector.id})`);
    },

    /**
     * 获取所有已注册的连接器
     * @returns {Object[]}
     */
    getAll() {
        return Object.values(this.connectors);
    },

    /**
     * 获取指定连接器
     * @param {string} id
     * @returns {Object|null}
     */
    get(id) {
        return this.connectors[id] || null;
    },

    /**
     * 设置当前激活的连接器
     * @param {string} connectorId
     */
    setActive(connectorId) {
        if (!this.connectors[connectorId]) {
            console.error(`[ConnectorManager] 未找到连接器: ${connectorId}`);
            return false;
        }
        this.activeConnectorId = connectorId;
        console.log(`[ConnectorManager] 已激活连接器: ${connectorId}`);
        return true;
    },

    /**
     * 获取当前激活的连接器
     * @returns {Object|null}
     */
    getActive() {
        return this.connectors[this.activeConnectorId] || null;
    },

    /**
     * 统一生图入口
     * @param {string} prompt
     * @param {string} negative
     * @param {Object} params
     * @param {Object} config
     * @returns {Promise}
     */
    async generate(prompt, negative, params, config) {
        const connector = this.getActive();
        if (!connector) {
            throw new Error('未选择图片生成模型，请先在设置中配置');
        }
        return await connector.generate(prompt, negative, params, config);
    }
};

// 导出到全局
window.SD_BaseConnector = BaseConnector;
window.SD_ConnectorManager = ConnectorManager;
window.SD_CONNECTORS = window.SD_CONNECTORS || [];
