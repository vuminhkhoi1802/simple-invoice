import { ArgumentsHost, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('GlobalExceptionFilter', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  it('formats a 404 with a message string', () => {
    const { status, body } = run(new NotFoundException('Invoice not found'));
    expect(status).toBe(404);
    expect(body).toEqual({ statusCode: 404, message: 'Invoice not found', error: 'Not Found' });
  });

  it('keeps validation message arrays intact', () => {
    const { body } = run(new BadRequestException(['dueDate must be on or after invoiceDate']));
    expect(body).toEqual({
      statusCode: 400,
      message: ['dueDate must be on or after invoiceDate'],
      error: 'Bad Request',
    });
  });

  it('derives the reason phrase when the exception has none', () => {
    const { body } = run(new ThrottlerException());
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
  });

  it('hides internals of unexpected errors', () => {
    const { status, body } = run(new Error('relation "invoices" does not exist'));
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
