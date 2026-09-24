import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Link } from "../links/entities/link.entity";
import { Profile } from "./entities/profile.entity";
import { AvatarController } from "./avatar.controller";
import { MyProfilesController } from "./my-profiles.controller";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { PublicProfilesController } from "./public-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Profile, Link])],
  controllers: [
    ProfilesController,
    MyProfilesController,
    PublicProfilesController,
    AvatarController,
  ],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
