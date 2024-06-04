import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RpcException } from '@nestjs/microservices';

import { readFileSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';

import fs from 'fs'

const password = "^ZJpLO/J@&gaP.1Zs,d,_mUvILgYxU,mJQ<w{<6{!W'[4-,MTyD<YU0Jq5pSi6^(EfYspx%-_d4{08@6^8W^G)X]|SEC|q'GJ>k'b3}RpT?GDF%>q(E2O[_qgqgPMM%DC>T[r&AkKHbEEfW^P6Tln94eifD1I/*!4=D7Ar3e6H1s2H/TCTyzpRu/%LDJ;e9jYSGch.>jskS>wSr=NbXH+'a#M_6U.u?Njo<%5zj?l)Ra;*Sr:=yRHB|"


/**
 * Отправляет уведомление в telegram
 * file extensions: png
 */
export const sendNotification = (payload: IMsgPayload) => {

  const mode = yml_config()?.mode || "prod";

  if (mode != "prod") {
    return;
  }

  // Создаем объект FormData
  const form = new FormData();

  if (payload.file?.path) {
    const fileBuffer = fs.readFileSync(payload.file.path);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    form.append('file', blob, 'file.png');
  }

  delete payload.file;

  for (const [key, value] of Object.entries(payload)) {
    if (['password', 'threadId', 'type'].includes(key)) continue;
    form.append(key, value.toString());
  }

  // Используем функцию для добавления или перезаписи полей
  form.append('password', password);
  form.append('threadId', payload.threadId || yml_config().threadId || null);
  form.append('type', payload.type || 'warning');

  try {
    return fetch("https://fk7o6bbxkhhv8ubkz4.findlerbot.com/api/send/", {
      method: "POST",
      body: form,
    });
  } catch (error) {
    console.error('Ошибка:', error);
  }
};

export type IMsgType = "info" | "warning" | "unhandled" | "fatal" | "debug";

export type IMsgPayload = {
  text: string;
  type?: IMsgType;
  description?: string;
  threadId?: number;
  file?: {
    path?: string
  };
};


/**
 *  Обработка ошибок при вызове методов RPC
 */
@Injectable()
export class GlobalErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        const error = new RpcException({
          statusCode: err.status || 500,
          message: err.message || 'Internal server error',
        });

        sendNotification({
          text: error.message,
          type: "unhandled",
          threadId: yml_config().threadId || 1,
        }).catch((error) => {
          console.log(error);
        });

        return throwError(() => error);
      }),
    );
  }
}

/**
 * #### Декоратор для обработки ошибок onModuleInit
 * @param {number} threadId - Идентификатор топика чата для уведомлений.
 * 
 * Для использования необходимо передать threadId в конфигурации микросервиса (1 - debug mode)
 * * 
 * #### Пример
 * 
 * ```ts
 * 
 * \@HandleModuleInitErrors()
 * async onModuleInit() {
 *   // логика инициализации модуля
 * }
 * ```
 */
export function HandleModuleInitErrors(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        await originalMethod.apply(this, args);
      } catch (error) {
        (async () => {
          try {
            await sendNotification({
              text: error.message || 'Internal server error',
              type: "fatal",
              threadId: yml_config()?.threadId || 1,
            });
          } catch (notificationError) {
            console.log('Ошибка при отправке уведомления:', notificationError);
          } finally {
            console.log('❌ Фатальное завершение работы приложения', error);
            process.exit(1);
          }
        })();
      }
    };

    return descriptor;
  };
}

const YAML_CONFIG_FILENAME = 'config.yml';

/**
 * Возвращает данные из config.yml
 */
export const yml_config = () => {
  let path = './',
    d = 1;

  while (
    d++ < 8 &&
    !existsSync(join(process.cwd(), path + YAML_CONFIG_FILENAME))
  )
    path += '../';

  try {
    return load(
      readFileSync(join(process.cwd(), path + YAML_CONFIG_FILENAME), 'utf8'),
    ) as Record<string, any>;
  }
  catch (e) {
    console.log(' === НЕ НАЙДЕН ФАЙЛ КОНФИГУРАЦИИ! ===')
    return {}
  }
};
