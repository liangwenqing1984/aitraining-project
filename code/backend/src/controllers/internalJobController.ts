import { Request, Response } from 'express';
import * as internalJobService from '../services/internalJobService';

export async function listJobs(req: Request, res: Response) {
  try {
    const { keyword, status, page, pageSize } = req.query;
    const data = await internalJobService.listInternalJobs({
      keyword: keyword as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 10,
    });
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('[InternalJob] listJobs error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

export async function getJob(req: Request, res: Response) {
  try {
    const job = await internalJobService.getInternalJob(Number(req.params.id));
    if (!job) {
      return res.status(404).json({ success: false, error: '岗位不存在' });
    }
    res.json({ success: true, data: job });
  } catch (e: any) {
    console.error('[InternalJob] getJob error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

export async function createJob(req: Request, res: Response) {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, error: '岗位名称和描述为必填' });
    }
    if (title.length > 300) {
      return res.status(400).json({ success: false, error: '岗位名称不能超过300字' });
    }

    const id = await internalJobService.createInternalJob(req.body);
    res.json({ success: true, data: { id }, message: '创建成功' });
  } catch (e: any) {
    console.error('[InternalJob] createJob error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}

export async function updateJob(req: Request, res: Response) {
  try {
    await internalJobService.updateInternalJob(Number(req.params.id), req.body);
    res.json({ success: true, message: '更新成功' });
  } catch (e: any) {
    console.error('[InternalJob] updateJob error:', e.message);
    if (e.message === '岗位不存在') {
      return res.status(404).json({ success: false, error: e.message });
    }
    res.status(500).json({ success: false, error: e.message });
  }
}

export async function deleteJob(req: Request, res: Response) {
  try {
    await internalJobService.deleteInternalJob(Number(req.params.id));
    res.json({ success: true, message: '删除成功' });
  } catch (e: any) {
    console.error('[InternalJob] deleteJob error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
}
