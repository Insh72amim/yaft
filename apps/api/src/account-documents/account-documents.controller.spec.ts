import type { Response } from 'express';
import type { AccountDocumentsService } from './account-documents.service';
import { AccountDocumentsController } from './account-documents.controller';

describe('AccountDocumentsController', () => {
  it('serves authenticated content inline with private no-store headers', async () => {
    const buffer = Buffer.from('%PDF-1.7\nsynthetic');
    const documents = {
      content: jest.fn().mockResolvedValue({
        buffer,
        name: 'synthetic agreement.pdf',
        mimeType: 'application/pdf',
      }),
    } as unknown as AccountDocumentsService;
    const set = jest.fn();
    const send = jest.fn();
    const response = { set, send } as unknown as Response;
    const controller = new AccountDocumentsController(documents);

    await controller.content({ id: 'owner-a' }, 'account-a', 'document-a', response);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': "inline; filename=\"document\"; filename*=UTF-8''synthetic%20agreement.pdf",
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
    }));
    expect(send).toHaveBeenCalledWith(buffer);
  });

  it('serves authenticated content as an attachment for downloads', async () => {
    const buffer = Buffer.from('synthetic image');
    const documents = {
      content: jest.fn().mockResolvedValue({
        buffer,
        name: 'supporting image (1).png',
        mimeType: 'image/png',
      }),
    } as unknown as AccountDocumentsService;
    const set = jest.fn();
    const send = jest.fn();
    const response = { set, send } as unknown as Response;
    const controller = new AccountDocumentsController(documents);

    await controller.download({ id: 'owner-a' }, 'account-a', 'document-a', response);

    expect(documents.content).toHaveBeenCalledWith('owner-a', 'account-a', 'document-a');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': "attachment; filename=\"document\"; filename*=UTF-8''supporting%20image%20%281%29.png",
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
    }));
    expect(send).toHaveBeenCalledWith(buffer);
  });
});
