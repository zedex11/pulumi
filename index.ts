import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// importing local configs
const env = pulumi.getStack()
const config = new pulumi.Config(`${env}`);
const vpc_name = config.require("vpc_name");
const zone_number = config.requireNumber("zone_number");
const vpc_cidr = config.require("vpc_cidr");
const number_of_nat_gateways = config.requireNumber("number_of_nat_gateways");
const instanceType = config.require("instance_type") as aws.ec2.InstanceType;

const baseTags = {
  "Name": `${vpc_name}`,
  "availability_zones_used": `${zone_number}`,
  "cidr_block": `${vpc_cidr}`,
  "crosswalk": "yes",
  "number_of_nat_gateways": `${number_of_nat_gateways}`,
  "demo": "true",
  "pulumi:Project": pulumi.getProject(),
  "pulumi:Stack": pulumi.getStack(),
  "cost_center": "1234",
}


// Allocate a new VPC with the CIDR range from config file:
const vpc = new awsx.ec2.Vpc(vpc_name, {
  cidrBlock: vpc_cidr,
  numberOfAvailabilityZones: zone_number,
  numberOfNatGateways: number_of_nat_gateways,
  tags: baseTags,

});

const amiId = aws.ec2.getAmi({
    filters: [
        {
            name: "name",
            values: ["amzn2-ami-hvm-2.0.*-x86_64-gp2"],
        }
    ],
    mostRecent: true,
    owners: ["137112412989"],
}, { async: true }).then(ami => ami.id)

const instancesSecurityGroup = new awsx.ec2.SecurityGroup(`${env}-instances-sg`,
    {
      vpc: vpc,
      description: 'The Security group for all instances that only allow ingress of the Load Balancer.',
      // Allow ingress only on port 80 from anywhere
      ingress: [{ fromPort: 80, toPort: 80, protocol: 'tcp', cidrBlocks: [ '0.0.0.0/0' ] }],
      egress: [{ fromPort: 0, toPort: 65535, protocol: 'tcp', cidrBlocks: [ '0.0.0.0/0' ] }]
    }
  );

  const autoScalingGroup = new awsx.autoscaling.AutoScalingGroup(`${env}-instance`, {
    templateParameters: { minSize: 1, maxSize: 2 },
    launchConfigurationArgs: { 
        instanceType: instanceType, 
        imageId: amiId, 
        securityGroups: [instancesSecurityGroup.id],
    },
    vpc: vpc,
    subnetIds: (env == 'prod') ? vpc.privateSubnetIds : vpc.publicSubnetIds,
});

// Export a few resulting fields to make them easy to use:
export const pulumi_vpc_name = vpc_name;
export const pulumi_vpc_id = vpc.id;
export const pulumi_vpc_az_zones = zone_number;
export const pulumi_vpc_cidr = vpc_cidr;
export const pulumic_vpc_number_of_nat_gateways = number_of_nat_gateways;
export const pulumi_vpc_private_subnet_ids = vpc.privateSubnetIds;
export const pulumi_vpc_public_subnet_ids = vpc.publicSubnetIds;
export const pulumi_vpc_aws_tags = baseTags;
