import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Actor } from '../http/actor'
import { AssessmentService } from './assessment.service'

@Controller('api/questions')
export class QuestionsController {
  constructor(
    @Inject(AssessmentService) private readonly service: AssessmentService,
  ) {}

  @Get()
  list(@Actor() actor: Actor, @Query('status') status?: string) {
    return this.service.listQuestions(actor, status)
  }

  @Post()
  create(@Actor() actor: Actor, @Body() body: unknown) {
    return this.service.createQuestion(actor, body)
  }

  @Patch(':id')
  update(
    @Actor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateQuestion(actor, id, body)
  }

  @Delete(':id')
  remove(@Actor() actor: Actor, @Param('id') id: string) {
    return this.service.removeQuestion(actor, id)
  }
}

@Controller('api/tests')
export class TestsController {
  constructor(
    @Inject(AssessmentService) private readonly service: AssessmentService,
  ) {}

  @Get()
  list(@Actor() actor: Actor) {
    return this.service.listTests(actor)
  }

  @Post()
  create(@Actor() actor: Actor, @Body() body: unknown) {
    return this.service.createTest(actor, body)
  }

  @Get(':id')
  get(@Actor() actor: Actor, @Param('id') id: string) {
    return this.service.getTest(actor, id)
  }
}

@Controller('api')
export class AssignmentsController {
  constructor(
    @Inject(AssessmentService) private readonly service: AssessmentService,
  ) {}

  @Post('groups/:groupId/assignments')
  assign(
    @Actor() actor: Actor,
    @Param('groupId') groupId: string,
    @Body() body: unknown,
  ) {
    return this.service.assign(actor, groupId, body)
  }

  @Get('groups/:groupId/assignments')
  listForGroup(@Actor() actor: Actor, @Param('groupId') groupId: string) {
    return this.service.listForGroup(actor, groupId)
  }

  @Get('me/assignments')
  mine(@Actor() actor: Actor) {
    return this.service.listMine(actor)
  }
}

@Controller('api/attempts')
export class AttemptsController {
  constructor(
    @Inject(AssessmentService) private readonly service: AssessmentService,
  ) {}

  @Get(':id')
  get(@Actor() actor: Actor, @Param('id') id: string) {
    return this.service.getAttempt(actor, id)
  }

  @Post(':id/submit')
  submit(
    @Actor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.submit(actor, id, body)
  }

  @Post(':id/audio/presign')
  presign(
    @Actor() actor: Actor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.presignAudio(actor, id, body)
  }

  @Get(':id/audio/:questionId')
  playback(
    @Actor() actor: Actor,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.service.playbackUrl(actor, id, questionId)
  }

  @Post(':id/grade')
  grade(@Actor() actor: Actor, @Param('id') id: string, @Body() body: unknown) {
    return this.service.grade(actor, id, body)
  }
}
