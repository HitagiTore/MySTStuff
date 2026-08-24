/**
 * SD Helper - 视频生成连接器 (ComfyUI)
 * 实现图生视频功能，基于 Wan2.1 等视频模型
 * 
 * 通过 SillyTavern 后端 API 绕过 CORS 限制
 */

const VideoComfyUIConnector = {
    id: 'video-comfyui',
    name: 'ComfyUI 视频',
    description: '连接 ComfyUI 生成视频（Wan2.1 等）',
    icon: '🎬',

    // ============ SillyTavern 后端 API 代理 ============

    _getSTHeaders() {
        if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getRequestHeaders === 'function') {
            return { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' };
        }
        return { 'Content-Type': 'application/json' };
    },

    async _stApiFetch(endpoint, body) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this._getSTHeaders(),
            body: JSON.stringify(body)
        });
        return response;
    },

    // ============ 图片压缩 ============

    /**
     * 压缩图片为 base64（用于视频生成输入）
     * @param {string} imageUrl - 图片URL
     * @param {number} maxSize - 最大边长（默认640）
     * @param {number} quality - JPEG质量（0-1）
     * @returns {Promise<string>} - 纯base64字符串（不含前缀）
     */
    async compressImageToBase64(imageUrl, maxSize = 640, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    // 计算缩放比例
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const newWidth = Math.round(img.width * scale);
                    const newHeight = Math.round(img.height * scale);
                    
                    // 创建 Canvas 并绘制
                    const canvas = document.createElement('canvas');
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);
                    
                    // 导出为 JPEG base64
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const base64 = dataUrl.split(',')[1];
                    
                    console.log(`[VideoConnector] 图片压缩: ${img.width}x${img.height} -> ${newWidth}x${newHeight}, 大小≈${Math.round(base64.length / 1024)}KB`);
                    resolve(base64);
                } catch (e) {
                    reject(e);
                }
            };
            
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = imageUrl;
        });
    },

    // ============ 核心方法 ============

    async testConnection(config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
        console.log('[VideoConnector] 通过 SillyTavern 后端测试连接:', url);

        try {
            const response = await this._stApiFetch('/api/sd/comfy/ping', { url });

            if (response.ok) {
                console.log('[VideoConnector] 连接成功！');
                return { success: true, message: '连接成功！' };
            } else {
                const errorText = await response.text();
                return {
                    success: false,
                    message: `连接失败 (HTTP ${response.status}): ${errorText || '请确保 ComfyUI 正在运行'}`
                };
            }
        } catch (e) {
            return { success: false, message: `连接异常: ${e.message}` };
        }
    },

    /**
     * 生成视频
     * @param {string} prompt - 视频提示词
     * @param {string} imageBase64 - 源图片base64（已压缩）
     * @param {Object} params - 生成参数
     * @param {Object} config - 连接器配置
     */
    async generate(prompt, imageBase64, params, config) {
        const url = (config.serverUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');

        console.log('[VideoConnector] 开始生成视频');
        console.log('[VideoConnector] 提示词:', prompt);
        console.log('[VideoConnector] 图片base64长度:', imageBase64?.length || 0);

        try {
            let workflowStr = typeof config.workflowJson === 'string'
                ? config.workflowJson
                : JSON.stringify(config.workflowJson);

            if (!workflowStr || workflowStr === '{}') {
                return { success: false, error: '请先配置视频生成 Workflow JSON' };
            }

            // 变量替换
            const dp = config.defaultParams || {};
            const VARIABLE_MAP = {
                '%prompt%': prompt,
                '%image%': imageBase64,
                '%width%': params.width || dp.width || 480,
                '%height%': params.height || dp.height || 640,
                '%frames%': params.frames || dp.frames || 81,
                '%fps%': params.fps || dp.fps || 16,
                '%steps%': params.steps || dp.steps || 20,
                '%cfg%': params.cfg || dp.cfg || 7,
                '%seed%': params.seed === -1 ? Math.floor(Math.random() * 2147483647) : (params.seed || -1),
            };

            // 转义JSON字符串中的特殊字符
            const escapeForJson = (str) => {
                if (typeof str !== 'string') return str;
                return str
                    .replace(/\\/g, '\\\\')  // 反斜杠
                    .replace(/"/g, '\\"')   // 双引号
                    .replace(/\n/g, '\\n')  // 换行符
                    .replace(/\r/g, '\\r')  // 回车符
                    .replace(/\t/g, '\\t')  // 制表符
                    .replace(/[\x00-\x1f]/g, (char) => {  // 其他控制字符
                        return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
                    });
            };

            for (const [varName, value] of Object.entries(VARIABLE_MAP)) {
                if (workflowStr.includes(varName)) {
                    // 字符串类型的值需要转义特殊字符（prompt需要转义，image是base64不需要）
                    const replacement = (typeof value === 'string' && varName === '%prompt%') 
                        ? escapeForJson(value) 
                        : (typeof value === 'string' ? value : String(value));
                    workflowStr = workflowStr.split(varName).join(replacement);
                    console.log(`[VideoConnector] 变量替换: ${varName} -> ${varName === '%image%' ? '[base64...]' : String(replacement).substring(0, 50)}`);
                }
            }

            const workflow = JSON.parse(workflowStr);

            const comfyPrompt = {
                prompt: workflow,
                client_id: 'sd-helper-video-' + Date.now()
            };

            // 发送生成请求
            const response = await this._stApiFetch('/api/sd/comfy/generate', {
                url: url,
                prompt: JSON.stringify(comfyPrompt)
            });

            if (!response.ok) {
                const errText = await response.text();
                return { success: false, error: `生成失败 (${response.status}): ${errText}` };
            }

            const result = await response.json();
            
            // 视频生成可能返回不同格式
            if (result.data) {
                // 返回视频 base64
                return { 
                    success: true, 
                    base64: result.data, 
                    format: result.format || 'mp4',
                    isVideo: true
                };
            }
            
            return { success: false, error: 'SillyTavern 未返回视频数据' };
        } catch (e) {
            console.error('[VideoConnector] 生成失败:', e);
            return { success: false, error: e.message };
        }
    },

    // ============ 配置相关 ============

    getDefaultConfig() {
        return {
            serverUrl: 'http://127.0.0.1:8188',
            workflowJson: '',
            currentWorkflow: '',          // 当前选中的工作流名称
            savedWorkflows: {},           // 已保存的工作流 { name: { workflow: '...', params: {...} } }
            defaultParams: {
                width: 480,
                height: 640,
                frames: 81,      // 约5秒 @ 16fps
                fps: 16,
                steps: 20,
                cfg: 7,
                seed: -1
            }
        };
    },

    renderConfigUI(config) {
        const c = { ...this.getDefaultConfig(), ...config };
        const dp = c.defaultParams || {};

        // 分辨率预设
        const resolutionOptions = [
            { value: '480x640', label: '480×640 (3:4 竖屏)', w: 480, h: 640 },
            { value: '512x512', label: '512×512 (1:1)', w: 512, h: 512 },
            { value: '640x480', label: '640×480 (4:3 横屏)', w: 640, h: 480 },
            { value: '512x768', label: '512×768 (2:3 竖屏)', w: 512, h: 768 },
        ];
        
        const currentRes = `${dp.width}x${dp.height}`;
        const resOptionsHtml = resolutionOptions.map(r => 
            `<option value="${r.value}" ${r.value === currentRes ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        // 生成已保存的工作流选项
        const savedWorkflows = c.savedWorkflows || {};
        const workflowNames = Object.keys(savedWorkflows);
        let workflowOptionsHtml = '<option value="">-- 新建工作流 --</option>';
        workflowNames.forEach(name => {
            const isSelected = c.currentWorkflow === name ? 'selected' : '';
            workflowOptionsHtml += `<option value="${name}" ${isSelected}>${name}</option>`;
        });

        // 生成默认视频工作流预设选项
        const defaultWorkflows = window.SD_DEFAULT_VIDEO_WORKFLOWS || {};
        const defaultWorkflowOptions = Object.keys(defaultWorkflows).map(name =>
            `<option value="${name}">${name}</option>`
        ).join('');

        return `
            <div class="sd-connector-config" data-connector="video-comfyui">
                <!-- 服务器地址 + 测试按钮 -->
                <div style="display:flex; gap:8px; margin-bottom:12px;">
                    <input type="text" id="sd-video-url" class="text_pole" style="flex:1;"
                           placeholder="http://127.0.0.1:8188" value="${c.serverUrl || ''}">
                    <button id="sd-video-test" class="sd-btn-secondary" style="white-space:nowrap;">🧪 测试连接</button>
                </div>

                <!-- 工作流选择器 -->
                <div style="margin-bottom:12px;">
                    <small style="color:#888;">视频工作流预设</small>
                    <div style="display:flex; gap:6px;">
                        <select id="sd-video-workflow-select" class="text_pole" style="flex:1;">
                            ${workflowOptionsHtml}
                        </select>
                        <button id="sd-video-save-workflow" class="sd-btn-secondary" style="padding:0 10px;" title="保存当前工作流">💾</button>
                        <button id="sd-video-delete-workflow" class="sd-btn-secondary" style="padding:0 10px; color:#f66;" title="删除选中工作流">🗑</button>
                    </div>
                    <!-- 默认模板选择器 -->
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <select id="sd-video-default-workflow" class="text_pole" style="flex:1;">
                            <option value="">-- 从默认模板加载 --</option>
                            ${defaultWorkflowOptions}
                        </select>
                        <button id="sd-video-load-default" class="sd-btn-secondary" style="padding:0 12px;" title="加载选中的默认模板">📥 加载</button>
                    </div>
                </div>

                <!-- Workflow JSON -->
                <div style="margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <small style="color:#888;">视频 Workflow JSON (I2V)</small>
                        <div style="display:flex; gap:4px;">
                            <button id="sd-video-upload" class="sd-btn-secondary" style="font-size:0.8em; padding:2px 8px;">📂 上传</button>
                            <button id="sd-video-paste" class="sd-btn-secondary" style="font-size:0.8em; padding:2px 8px;">📋 粘贴</button>
                        </div>
                    </div>
                    <textarea id="sd-video-workflow" class="text_pole" rows="4" 
                              style="font-family:monospace; font-size:0.8em;"
                              placeholder="粘贴 I2V Workflow JSON，需包含 %prompt% 和 %image% 变量...">${c.workflowJson || ''}</textarea>
                    <small style="color:#666; display:block; margin-top:4px;">
                        💡 变量: %prompt%, %image%, %width%, %height%, %frames%, %fps%, %steps%, %cfg%, %seed%
                    </small>
                </div>

                <!-- 生成参数 -->
                <div style="padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:12px;">
                    <small style="color:#888; display:block; margin-bottom:8px;">生成参数</small>
                    
                    <!-- 分辨率下拉 -->
                    <div style="margin-bottom:8px;">
                        <small style="color:#666; font-size:0.75em;">视频分辨率</small>
                        <select id="sd-video-resolution" class="text_pole" style="width:100%;">
                            ${resOptionsHtml}
                        </select>
                    </div>
                    
                    <!-- 帧数 + FPS -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
                        <div>
                            <small style="color:#666; font-size:0.75em;">帧数</small>
                            <input type="number" id="sd-video-frames" class="text_pole" value="${dp.frames || 81}" min="1" max="300" style="font-size:0.85em;">
                        </div>
                        <div>
                            <small style="color:#666; font-size:0.75em;">FPS</small>
                            <input type="number" id="sd-video-fps" class="text_pole" value="${dp.fps || 16}" min="1" max="60" style="font-size:0.85em;">
                        </div>
                    </div>
                    
                    <small style="color:#666; display:block; margin-top:6px;">
                        ⏱️ 视频时长 ≈ ${Math.round((dp.frames || 81) / (dp.fps || 16) * 10) / 10} 秒
                    </small>
                </div>
            </div>`;
    },

    parseConfigFromUI(existingConfig = {}) {
        // 解析分辨率
        const resolution = $('#sd-video-resolution').val() || '480x640';
        const [width, height] = resolution.split('x').map(Number);

        return {
            serverUrl: $('#sd-video-url').val() || 'http://127.0.0.1:8188',
            workflowJson: $('#sd-video-workflow').val() || '',
            currentWorkflow: $('#sd-video-workflow-select').val() || '',
            savedWorkflows: existingConfig.savedWorkflows || {},  // 保留已存在的工作流
            defaultParams: {
                width: width,
                height: height,
                frames: parseInt($('#sd-video-frames').val()) || 81,
                fps: parseInt($('#sd-video-fps').val()) || 16,
                // 保留默认值用于变量替换，但不从UI读取
                steps: 20, 
                cfg: 7, 
                seed: -1
            }
        };
    }
};

// 注册连接器
if (typeof window !== 'undefined') {
    window.SD_CONNECTORS = window.SD_CONNECTORS || [];
    window.SD_CONNECTORS.push(VideoComfyUIConnector);
    window.SD_VideoComfyUIConnector = VideoComfyUIConnector;
}
