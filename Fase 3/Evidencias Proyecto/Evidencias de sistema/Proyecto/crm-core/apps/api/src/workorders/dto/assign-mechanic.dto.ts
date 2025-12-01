import { IsInt } from 'class-validator';

export class AssignMechanicDto {
  @IsInt()
  workOrderId!: number;

  @IsInt()
  mechanicId!: number;
}
