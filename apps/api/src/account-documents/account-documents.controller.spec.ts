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
});
