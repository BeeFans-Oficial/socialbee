import { Global, Module } from "@nestjs/common";

import { StorageService } from "./storage.service";

/** Global: perfis e links gravam imagem, e as views públicas montam URL. */
@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
