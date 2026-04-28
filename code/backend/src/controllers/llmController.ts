import { Request, Response } from 'express';
import { ApiResponse, LLMConfig, LLMProvider } from '../types';
import { llmService } from '../services/llm';
import { startEnrichment, getEnrichmentStatus, getEnrichmentResults } from '../services/llm/enrichment';
import { generateInsights, getInsightsHistory, getInsightsReport } from '../services/llm/insights';
import { executeNLQuery, getQueryHistory, deleteQuery } from '../services/llm/query';
import { classifyPage, suggestSelectors, recommendAction } from '../services/llm/antiCrawl';

// 获取所有LLM配置
export async function listConfigs(req: Request, res: Response) {
  try {
    const configs = await llmService.listConfigs();
    return res.json({ success: true, data: configs } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 获取配置列表失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 保存LLM配置
export async function saveConfig(req: Request, res: Response) {
  try {
    const config: LLMConfig = req.body;

    if (!config.provider || !config.modelName) {
      return res.status(400).json({
        success: false,
        error: 'provider 和 modelName 为必填项'
      } as ApiResponse);
    }

    // Encrypt API key before storing
    if (config.apiKeyEncrypted && config.apiKeyEncrypted !== '***') {
      // Key is plaintext from frontend, encrypted by saveConfig in llmService
    }

    const saved = await llmService.saveConfig(config);

    return res.json({
      success: true,
      data: saved,
      message: config.id ? '配置已更新' : '配置已创建'
    } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 保存配置失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 删除LLM配置
export async function deleteConfig(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效的配置ID' } as ApiResponse);
    }

    await llmService.deleteConfig(id);
    return res.json({ success: true, message: '配置已删除' } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 删除配置失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 健康检查
export async function healthCheck(req: Request, res: Response) {
  try {
    const provider = req.query.provider as LLMProvider;
    if (!provider || !['openai', 'anthropic', 'ollama', 'deepseek', 'zhipu'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: '请指定有效的 provider: openai, anthropic, ollama, deepseek, zhipu'
      } as ApiResponse);
    }

    const result = await llmService.healthCheck(provider);
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 健康检查失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 测试LLM调用
export async function testCall(req: Request, res: Response) {
  try {
    const { systemPrompt, userPrompt, taskType } = req.body;

    if (!userPrompt) {
      return res.status(400).json({
        success: false,
        error: '请提供 userPrompt'
      } as ApiResponse);
    }

    const result = await llmService.callLLM(
      systemPrompt || 'You are a helpful assistant.',
      userPrompt,
      {
        taskType: taskType || 'query',
        temperature: 0.7,
        maxTokens: 1024,
      }
    );

    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 测试调用失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 触发数据增强
export async function enrichTask(req: Request, res: Response) {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ success: false, error: '请提供 taskId' } as ApiResponse);
    }

    // 异步启动增强，立即返回
    startEnrichment(taskId).catch((e) => {
      console.error(`[LLMController] 增强任务 ${taskId} 失败:`, e.message);
    });

    return res.json({
      success: true,
      message: '数据增强已启动，请通过 WebSocket 监听进度',
    } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 启动增强失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 获取增强状态
export async function getEnrichStatus(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const status = await getEnrichmentStatus(taskId);
    return res.json({ success: true, data: status } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 获取增强状态失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 获取增强结果
export async function getEnrichResults(req: Request, res: Response) {
  try {
    const { taskId } = req.params;
    const results = await getEnrichmentResults(taskId);
    return res.json({ success: true, data: results } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 获取增强结果失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// ==================== 市场洞察 ====================

// 生成市场洞察报告
export async function generateInsight(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ success: false, error: '请提供 fileId' } as ApiResponse);
    }

    // 异步生成，立即返回
    generateInsights(fileId).then((report) => {
      console.log(`[LLMController] 报告生成完成: ${report.id}`);
      // 通过 WebSocket 通知（如果存在 io 引用）
      try {
        const { io } = require('../../app');
        io.emit('insights:completed', { fileId, reportId: report.id, title: report.title });
      } catch {}
    }).catch((e) => {
      console.error(`[LLMController] 报告生成失败:`, e.message);
    });

    return res.json({ success: true, message: '报告生成已启动' } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] 生成报告失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 获取报告历史
export async function getInsightHistory(req: Request, res: Response) {
  try {
    const { fileId } = req.params;
    const reports = await getInsightsHistory(fileId);
    return res.json({ success: true, data: reports } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 获取单个报告
export async function getInsightReport(req: Request, res: Response) {
  try {
    const { reportId } = req.params;
    const report = await getInsightsReport(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' } as ApiResponse);
    }
    return res.json({ success: true, data: report } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// ==================== 自然语言查询 ====================

// 执行自然语言查询
export async function queryData(req: Request, res: Response) {
  try {
    const { question, taskId } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: '请提供 question' } as ApiResponse);
    }

    const result = await executeNLQuery(question, taskId);
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    console.error('[LLMController] NL查询失败:', error.message);
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 获取查询历史
export async function getQueryHist(req: Request, res: Response) {
  try {
    const history = await getQueryHistory();
    return res.json({ success: true, data: history } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 删除查询记录
export async function deleteQueryRecord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await deleteQuery(id);
    return res.json({ success: true, message: '查询记录已删除' } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// ==================== AI 反爬 ====================

// 页面分类
export async function classifyPageAction(req: Request, res: Response) {
  try {
    const { html, url } = req.body;
    if (!html) {
      return res.status(400).json({ success: false, error: '请提供 html 内容' } as ApiResponse);
    }

    const result = await classifyPage(html, url || '');
    return res.json({ success: true, data: result } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 选择器推荐
export async function suggestSelectorsAction(req: Request, res: Response) {
  try {
    const { html, target } = req.body;
    if (!html || !target) {
      return res.status(400).json({ success: false, error: '请提供 html 和 target' } as ApiResponse);
    }

    const suggestions = await suggestSelectors(html, target);
    return res.json({ success: true, data: suggestions } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}

// 应对策略推荐
export async function recommendActionAction(req: Request, res: Response) {
  try {
    const { classification } = req.body;
    if (!classification) {
      return res.status(400).json({ success: false, error: '请提供 classification' } as ApiResponse);
    }

    const recommendation = await recommendAction(classification);
    return res.json({ success: true, data: recommendation } as ApiResponse);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message } as ApiResponse);
  }
}
