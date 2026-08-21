/**
 * SD Helper - NovelAI 连接器
 * 直接调用 NovelAI API（与 sd-helper-novelai-add-1.js 相同方式）
 * 
 * v4.1 - 修复版：完全复制有效脚本的请求体，使用生图端点测试连接
 */

const NovelAIConnector = {
    id: 'novelai',
    name: 'NovelAI',
    description: '连接 NovelAI 图像生成服务（直连模式）',
    icon: '🎨',

    // 可用模型
    MODELS: [
        { id: 'nai-diffusion-5-full', name: 'NAI Diffusion V5 Full (最新)' },
        { id: 'nai-diffusion-5-curated', name: 'NAI Diffusion V5 Curated' },
        { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full' },
        { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated' },
        { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated' },
        { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full' },
        { id: 'nai-diffusion-3', name: 'NAI Diffusion V3' },
        { id: 'nai-diffusion-furry-3', name: 'NAI Diffusion Furry V3' },
        { id: 'safe-diffusion', name: 'Safe Diffusion' },
        { id: 'furry-3', name: 'Furry V3' }
    ],

    // 可用采样器
    SAMPLERS: [
        { id: 'k_euler', name: 'Euler' },
        { id: 'k_euler_ancestral', name: 'Euler a' },
        { id: 'k_dpmpp_2m', name: 'DPM++ 2M' },
        { id: 'k_dpmpp_2m_ancestral', name: 'DPM++ 2M a' },
        { id: 'k_dpmpp_sde', name: 'DPM++ SDE' },
        { id: 'ddim', name: 'DDIM' }
    ],

    // 可用调度器
    SCHEDULERS: [
        { id: 'karras', name: 'Karras' },
        { id: 'normal', name: 'Normal' },
        { id: 'exponential', name: 'Exponential' },
        { id: 'polyexponential', name: 'Polyexponential' }
    ],

    // 完整分辨率预设 (注意: NovelAI 要求宽高必须是 64 的倍数)
    RESOLUTIONS: [
        { w: 512, h: 512, label: '512x512 (1:1, 小图)' },
        { w: 640, h: 640, label: '640x640 (1:1)' },
        { w: 512, h: 768, label: '512x768 (2:3, 竖版)' },
        { w: 768, h: 512, label: '768x512 (3:2, 横版)' },
        { w: 576, h: 960, label: '576x960 (9:16, 竖版壁纸)' },
        { w: 960, h: 576, label: '960x576 (16:9, 横版壁纸)' },
        { w: 704, h: 1280, label: '704x1280 (9:16, 720p)' },
        { w: 1280, h: 704, label: '1280x704 (16:9, 720p)' },
        { w: 1088, h: 1920, label: '1088x1920 (9:16, 1080p)' },
        { w: 1920, h: 1088, label: '1920x1088 (16:9, 1080p)' },
        { w: 1024, h: 1024, label: '1024x1024 (1:1, SDXL)' },
        { w: 896, h: 1152, label: '896x1152 (7:9, SDXL)' },
        { w: 1152, h: 896, label: '1152x896 (9:7, SDXL)' },
        { w: 832, h: 1216, label: '832x1216 (13:19, SDXL 竖版推荐)' },
        { w: 1216, h: 832, label: '1216x832 (19:13, SDXL 横版推荐)' },
        { w: 768, h: 1344, label: '768x1344 (3:4, SDXL)' },
        { w: 1344, h: 768, label: '1344x768 (4:3, SDXL)' },
        { w: 640, h: 1536, label: '640x1536 (10:24, SDXL)' },
        { w: 1536, h: 640, label: '1536x640 (24:10, SDXL)' },
        { w: 1024, h: 1536, label: '1024x1536 (2:3)' },
        { w: 1536, h: 1024, label: '1536x1024 (3:2)' },
        { w: 1024, h: 1792, label: '1024x1792 (4:7)' },
        { w: 1792, h: 1024, label: '1792x1024 (7:4)' }
    ],

    // ============ 核心方法 ============

    async testConnection(config) {
        console.log('[NovelAI] 测试连接...');

        if (!config.apiToken) {
            return { success: false, message: '请配置 API Token' };
        }

        // 验证 Token 格式
        if (!config.apiToken.startsWith('pst-')) {
            return { success: false, message: 'Token 格式错误，应以 pst- 开头' };
        }

        // 真正调用 NovelAI API 验证 Token
        try {
            const response = await fetch('https://image.novelai.net/ai/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiToken}`
                },
                body: JSON.stringify({ input: '', model: 'test', parameters: {} }) // 最小请求体
            });

            // 401/403 = Token 无效
            if (response.status === 401 || response.status === 403) {
                return { success: false, message: 'Token 无效或已过期，请检查' };
            }

            // 400 = 请求参数错误，但 Token 有效（预期）
            // 200 = 不太可能，但也算成功
            if (response.status === 400 || response.ok) {
                return { success: true, message: '✅ 连接成功，Token 有效！' };
            }

            // 其他错误
            return { success: false, message: `连接异常 (HTTP ${response.status})` };
        } catch (e) {
            // 网络错误（可能是 CORS 或真的网络问题）
            // 如果是 TypeError: Failed to fetch，通常是 CORS 问题，但 NovelAI 应该支持
            return { success: false, message: `网络错误: ${e.message}` };
        }
    },

    async generate(prompt, negative, params, config) {
        console.log('[NovelAI] 生成图片...');
        console.log('[NovelAI] 正向提示词:', prompt);

        if (!config.apiToken) {
            return { success: false, error: '请配置 API Token' };
        }

        try {
            const c = { ...this.getDefaultConfig(), ...config };
            const p = c.defaultParams || {};

            // 添加提示词前缀
            const finalPrompt = c.promptPrefix
                ? `${c.promptPrefix.trim()}, ${prompt}`.replace(/,\s*,/g, ',').trim()
                : prompt;

            const finalNegative = negative || c.undesiredContent || '';

            const width = params.width || p.width || 832;
            const height = params.height || p.height || 1216;

            // seed 处理：-1 或未定义时随机生成
            const inputSeed = params.seed !== undefined ? params.seed : (p.seed !== undefined ? p.seed : -1);
            const seed = (inputSeed >= 0) ? inputSeed : Math.floor(Math.random() * 4294967295);

            const modelName = c.model || 'nai-diffusion-4-5-full';
            const isV45 = modelName.includes('nai-diffusion-4-5');

            // 计算 variety_boost 的 skip_cfg_above_sigma
            let skipCfgAboveSigma = null;
            if (p.variety_boost) {
                const magicConstant = isV45 ? 58 : 19;
                const pixelCount = width * height;
                const ratio = pixelCount / 1011712;
                skipCfgAboveSigma = Math.pow(ratio, 0.5) * magicConstant;
            }

            // 构建请求体（完全复制 sd-helper-novelai-add-1.js 的格式）
            const requestBody = {
                action: 'generate',
                input: String(finalPrompt || ''),
                model: modelName,
                parameters: {
                    params_version: 3,
                    width,
                    height,
                    scale: params.cfg || p.cfg || 6,
                    seed,
                    sampler: params.sampler || p.sampler || 'k_euler_ancestral',
                    noise_schedule: p.scheduler || 'karras',
                    steps: params.steps || p.steps || 28,
                    n_samples: 1,
                    ucPreset: p.ucPreset || 0,
                    qualityToggle: p.qualityToggle !== undefined ? p.qualityToggle : true,
                    autoSmea: p.autoSmea !== undefined ? p.autoSmea : false,
                    cfg_rescale: p.cfg_rescale || 0,
                    dynamic_thresholding: p.decrisper !== undefined ? p.decrisper : false,
                    controlnet_strength: 1,
                    legacy: false,
                    add_original_image: true,
                    legacy_v3_extend: false,
                    use_coords: false,
                    legacy_uc: false,
                    normalize_reference_strength_multiple: true,
                    inpaintImg2ImgStrength: 1,
                    deliberate_euler_ancestral_bug: false,
                    prefer_brownian: true,
                    image_format: 'png',
                    skip_cfg_above_sigma: skipCfgAboveSigma,
                    sm: p.sm !== undefined ? p.sm : false,
                    sm_dyn: p.sm_dyn !== undefined ? p.sm_dyn : false,
                    characterPrompts: [],
                    v4_prompt: {
                        caption: {
                            base_caption: String(finalPrompt || ''),
                            char_captions: []
                        },
                        use_coords: false,
                        use_order: true
                    },
                    v4_negative_prompt: {
                        caption: {
                            base_caption: String(finalNegative || ''),
                            char_captions: []
                        },
                        legacy_uc: false
                    },
                    negative_prompt: String(finalNegative || '')
                }
            };

            console.log('[NovelAI] 请求:', requestBody);

            const response = await fetch('https://image.novelai.net/ai/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiToken}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[NovelAI] 生成失败:', response.status, errText);
                if (response.status === 402) {
                    return { success: false, error: 'Anlas 不足，请充值' };
                }
                return { success: false, error: `API 错误 (${response.status}): ${errText}` };
            }

            // NovelAI 返回 ZIP 格式
            const zipData = await response.arrayBuffer();
            const base64 = await this._extractImageFromZip(zipData);

            if (base64) {
                console.log('[NovelAI] 生成成功');
                return { success: true, base64, format: 'png' };
            } else {
                return { success: false, error: '无法从 ZIP 中提取图片' };
            }
        } catch (e) {
            console.error('[NovelAI] 异常:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * 从 ZIP 中提取 PNG 图片
     */
    async _extractImageFromZip(zipData) {
        try {
            // 动态加载 JSZip
            if (!window.JSZip) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const zip = await window.JSZip.loadAsync(zipData);
            const file = Object.values(zip.files).find(f => f.name.endsWith('.png') || f.name.endsWith('.webp'));
            if (!file) return null;
            return await file.async('base64');
        } catch (e) {
            console.error('[NovelAI] ZIP 解析失败:', e);
            return null;
        }
    },

    // ============ 配置相关 ============

    getDefaultConfig() {
        return {
            apiToken: '',
            model: 'nai-diffusion-4-5-full',
            promptPrefix: 'best quality, amazing quality, very aesthetic, absurdres,',
            testPrompt: '1girl, masterpiece, best quality',
            defaultParams: {
                steps: 28,
                cfg: 6,
                width: 832,
                height: 1216,
                sampler: 'k_euler_ancestral',
                scheduler: 'karras',
                seed: -1,
                qualityToggle: true,
                autoSmea: false,
                sm: false,
                sm_dyn: false,
                decrisper: false,
                variety_boost: false,
                cfg_rescale: 0,
                ucPreset: 0
            },
            undesiredContent: 'lowres, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
        };
    },

    getConfigFields() {
        return [
            { key: 'apiToken', label: 'API Token', type: 'password' },
            { key: 'model', label: '模型', type: 'select', options: this.MODELS }
        ];
    },

    renderConfigUI(config) {
        const c = { ...this.getDefaultConfig(), ...config };
        const p = c.defaultParams || {};

        const modelOptions = this.MODELS.map(m =>
            `<option value="${m.id}" ${c.model === m.id ? 'selected' : ''}>${m.name}</option>`
        ).join('');

        const samplerOptions = this.SAMPLERS.map(s =>
            `<option value="${s.id}" ${p.sampler === s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        const schedulerOptions = this.SCHEDULERS.map(s =>
            `<option value="${s.id}" ${p.scheduler === s.id ? 'selected' : ''}>${s.name}</option>`
        ).join('');

        const resolutionOptions = this.RESOLUTIONS.map(r =>
            `<option value="${r.w}x${r.h}" ${p.width === r.w && p.height === r.h ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        // 获取预设列表（从全局 settings）
        const presets = window.SD_SETTINGS?.promptPresets || { 'Default': { prefix: '', suffix: '', negative: '' } };
        const presetOptions = Object.keys(presets).map(name =>
            `<option value="${name}" ${name === c.selectedPreset ? 'selected' : ''}>${name}</option>`
        ).join('');

        return `
            <div class="sd-connector-config" data-connector="novelai">
                <!-- 前后缀预设选择 -->
                <div style="margin-bottom:12px; padding:10px; background:rgba(0,0,0,0.15); border-radius:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <label style="font-size:0.9em; color:#aaa; white-space:nowrap;">📝 前后缀预设:</label>
                        <select id="sd-novelai-preset-select" class="text_pole" style="flex:1; font-size:0.9em;">
                            ${presetOptions}
                        </select>
                        <button id="sd-novelai-preset-edit" class="sd-btn-secondary" title="编辑预设" style="padding:4px 8px; font-size:0.85em;">✏️</button>
                    </div>
                </div>

                <div class="sd-api-row">
                    <label>API Token</label>
                    <input type="password" id="sd-novelai-token" class="text_pole" 
                           placeholder="pst-xxxxxxxx (从 NovelAI 账户设置获取)" value="${c.apiToken || ''}">
                </div>
                
                <button id="sd-novelai-test" class="sd-btn-secondary" style="width:100%; margin-bottom:15px;">🧪 测试连接</button>
                
                <div class="sd-api-row">
                    <label>模型版本</label>
                    <select id="sd-novelai-model" class="text_pole">${modelOptions}</select>
                </div>
                
                <div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:15px;">
                    <label style="display:block; margin-bottom:10px; font-weight:600;">生图参数</label>
                    
                    <div style="margin-bottom:10px;">
                        <small style="color:#888; display:block; margin-bottom:4px;">分辨率</small>
                        <select id="sd-novelai-resolution" class="text_pole" style="width:100%">${resolutionOptions}</select>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                        <div>
                            <small style="color:#888;">采样器</small>
                            <select id="sd-novelai-sampler" class="text_pole">${samplerOptions}</select>
                        </div>
                        <div>
                            <small style="color:#888;">调度器</small>
                            <select id="sd-novelai-scheduler" class="text_pole">${schedulerOptions}</select>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:10px;">
                        <div>
                            <small style="color:#888;">CFG Scale</small>
                            <input type="number" id="sd-novelai-cfg" class="text_pole" 
                                   value="${p.cfg || 6}" min="1" max="20" step="0.5">
                        </div>
                        <div>
                            <small style="color:#888;">步数</small>
                            <input type="number" id="sd-novelai-steps" class="text_pole" 
                                   value="${p.steps || 28}" min="1" max="50">
                        </div>
                        <div>
                            <small style="color:#888;">种子 (-1随机)</small>
                            <input type="number" id="sd-novelai-seed" class="text_pole" 
                                   value="${p.seed !== undefined ? p.seed : -1}">
                        </div>
                    </div>
                    
                    <div style="margin-top:12px; padding:10px; background:rgba(0,0,0,0.15); border-radius:6px;">
                        <small style="color:#888; display:block; margin-bottom:8px;">进阶设置</small>
                        <div style="display:flex; flex-wrap:wrap; gap:12px;">
                            <label title="提升整体画质和细节（建议开启）" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-quality-toggle" ${p.qualityToggle ? 'checked' : ''}>
                                <span style="font-size:0.85em;">Quality+</span>
                            </label>
                            <label title="自动调整 SMEA 参数，优化大图生成" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-auto-smea" ${p.autoSmea ? 'checked' : ''}>
                                <span style="font-size:0.85em;">Auto SMEA</span>
                            </label>
                            <label title="SMEA (Sinusoidal Multipass Euler Ancestral) 采样优化 (不适用于 V4 以上模型)" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-sm" ${p.sm ? 'checked' : ''}>
                                <span style="font-size:0.85em;">SMEA<span style="color:#aaa; font-size:0.9em; margin-left:2px;">(仅V3)</span></span>
                            </label>
                            <label title="SMEA DYN (Dynamic) 动态采样优化 (不适用于 V4 以上模型)" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-sm-dyn" ${p.sm_dyn ? 'checked' : ''}>
                                <span style="font-size:0.85em;">SMEA DYN<span style="color:#aaa; font-size:0.9em; margin-left:2px;">(仅V3)</span></span>
                            </label>
                            <label title="降低画面噪点和过锐化" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-decrisper" ${p.decrisper ? 'checked' : ''}>
                                <span style="font-size:0.85em;">Decrisper</span>
                            </label>
                            <label title="增加画面多样性" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" id="sd-novelai-variety-boost" ${p.variety_boost ? 'checked' : ''}>
                                <span style="font-size:0.85em;">Variety+</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <!-- 提示词前缀和负面提示词已移除，使用全局设置 -->
                
                <!-- 测试生图区域 -->
                <div style="margin-bottom:15px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
                    <label style="display:block; margin-bottom:8px; font-weight:600;">🖼️ 测试生图</label>
                    <div style="display:flex; gap:8px; margin-bottom:10px;">
                        <input type="text" id="sd-novelai-test-prompt" class="text_pole" 
                               placeholder="输入测试提示词，如: 1girl, smile" 
                               style="flex:1;" value="${c.testPrompt || '1girl, masterpiece, best quality'}">
                        <button id="sd-novelai-test-gen" class="sd-btn-primary" style="white-space:nowrap;">🎨 生成</button>
                    </div>
                    <div id="sd-novelai-test-result" style="text-align:center; min-height:100px; background:rgba(0,0,0,0.1); border-radius:6px; padding:10px; display:flex; align-items:center; justify-content:center;">
                        <span style="color:#888;">点击"生成"按钮测试</span>
                    </div>
                </div>
                
                <div style="padding:10px; background:rgba(108,140,255,0.1); border-radius:8px; border-left:3px solid var(--nm-accent);">
                    <small style="color:var(--nm-accent);">
                        ⚠️ NovelAI 是付费服务，生图会消耗 Anlas。
                    </small>
                </div>
            </div>`;
    },

    parseConfigFromUI() {
        const resolution = $('#sd-novelai-resolution').val()?.split('x') || ['832', '1216'];

        return {
            selectedPreset: $('#sd-novelai-preset-select').val() || 'Default',
            apiToken: $('#sd-novelai-token').val() || '',
            model: $('#sd-novelai-model').val() || 'nai-diffusion-4-5-full',
            testPrompt: $('#sd-novelai-test-prompt').val() || '1girl, masterpiece, best quality',
            // 提示词前缀和负面提示词现在统一使用全局设置，这里不再单独读取
            defaultParams: {
                steps: parseInt($('#sd-novelai-steps').val()) || 28,
                cfg: parseFloat($('#sd-novelai-cfg').val()) || 6,
                seed: parseInt($('#sd-novelai-seed').val()) || -1,
                width: parseInt(resolution[0]) || 832,
                height: parseInt(resolution[1]) || 1216,
                sampler: $('#sd-novelai-sampler').val() || 'k_euler_ancestral',
                scheduler: $('#sd-novelai-scheduler').val() || 'karras',
                qualityToggle: $('#sd-novelai-quality-toggle').is(':checked'),
                autoSmea: $('#sd-novelai-auto-smea').is(':checked'),
                sm: $('#sd-novelai-sm').is(':checked'),
                sm_dyn: $('#sd-novelai-sm-dyn').is(':checked'),
                decrisper: $('#sd-novelai-decrisper').is(':checked'),
                variety_boost: $('#sd-novelai-variety-boost').is(':checked'),
                cfg_rescale: 0,
                ucPreset: 0
            },
            undesiredContent: '' // 使用全局负面提示词
        };
    },

    validateConfig(config) {
        if (!config.apiToken) {
            return { valid: false, errors: ['请配置 API Token'] };
        }
        return { valid: true, errors: [] };
    }
};

// 注册连接器
if (typeof window !== 'undefined') {
    window.SD_CONNECTORS = window.SD_CONNECTORS || [];
    window.SD_CONNECTORS.push(NovelAIConnector);
    window.SD_NovelAIConnector = NovelAIConnector;
}
