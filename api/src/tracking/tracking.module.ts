import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LinksModule } from "../links/links.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { LinkCounter } from "./entities/link-counter.entity";
import { TrackingEvent } from "./entities/tracking-event.entity";
import { MeTrackingController } from "./me-tracking.controller";
import { PublicTrackingController } from "./public-tracking.controller";
import { RetentionService } from "./retention.service";
import { PostgresTrackingStore } from "./tracking.store";
import { TrackingService } from "./tracking.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingEvent, LinkCounter]),
    ProfilesModule,
    LinksModule,
  ],
  controllers: [PublicTrackingController, MeTrackingController],
  providers: [PostgresTrackingStore, TrackingService, RetentionService],
  exports: [TrackingService],
})
export class TrackingModule {}
